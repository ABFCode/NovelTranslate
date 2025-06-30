import json
import logging
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Optional

import keyring

from app.core.constants import APP_SERVICE_NAME
from app.core.translator import TranslationResult, Translator


@dataclass
class TranslationUpdate:
    """Message for UI updates from the translation process."""

    type: str  # "progress", "log", "status", "complete", "error"
    chapter_number: Optional[int] = None
    status: Optional[str] = None  # "in_progress", "completed", "error", "pending"
    message: Optional[str] = None
    error: Optional[str] = None
    progress_percentage: Optional[float] = None


class TranslationOrchestrator:
    """Manages the translation process with threading and UI updates."""

    def __init__(self, app_state, config_manager):
        self.app_state = app_state
        self.config_manager = config_manager
        self.translator = Translator()

        self.is_running = False
        self.is_paused = threading.Event()
        self.is_paused.set()
        self.should_cancel = threading.Event()
        self.translation_thread = None

        self.current_chapter = 0
        self.total_chapters = 0
        self.completed_chapters = 0
        self.failed_chapters = 0
        self.chapters_lock = threading.Lock()

        self.project_dir = None
        self.chapters_dir = None

        self.max_concurrent_chapters = 3

    def start_translation(
        self, on_update_callback: Callable[[TranslationUpdate], None]
    ):
        """Start the translation process in a background thread."""
        if self.is_running:
            logging.warning("Translation already running")
            return False

        if not self.app_state.active_config_name:
            return False

        if not self.app_state.epub_data["chapters_meta"]:
            return False

        self.is_running = True
        self.should_cancel.clear()
        self.is_paused.set()
        self.current_chapter = 0
        self.total_chapters = len(self.app_state.epub_data["chapters_meta"])
        self.completed_chapters = 0
        self.failed_chapters = 0

        if not self._setup_project_directory():
            on_update_callback(
                TranslationUpdate(
                    type="error", error="Failed to create project directory"
                )
            )
            return False

        self.translation_thread = threading.Thread(
            target=self._translation_worker, args=(on_update_callback,), daemon=True
        )
        self.translation_thread.start()
        return True

    def pause_translation(self):
        """Pause the translation process."""
        if self.is_running:
            self.is_paused.clear()

    def resume_translation(self):
        """Resume the translation process."""
        if self.is_running:
            self.is_paused.set()

    def cancel_translation(self):
        """Cancel the translation process."""
        if self.is_running:
            self.should_cancel.set()
            self.is_paused.set()

    def _translation_worker(
        self, on_update_callback: Callable[[TranslationUpdate], None]
    ):
        """Main translation loop running in background thread with parallel processing."""
        try:
            update = TranslationUpdate(type="status", message="Starting translation...")
            on_update_callback(update)

            config = self.config_manager.get_config(self.app_state.active_config_name)
            if not config:
                update = TranslationUpdate(
                    type="error", error="Configuration not found"
                )
                on_update_callback(update)
                return

            api_keys = self._load_api_keys()

            chapters = self.app_state.epub_data["chapters_meta"]

            chapters_to_translate = [
                (i, chapter_meta)
                for i, chapter_meta in enumerate(chapters)
                if chapter_meta.get("status") != "completed"
            ]

            if not chapters_to_translate:
                update = TranslationUpdate(
                    type="complete",
                    message="All chapters already completed!",
                    progress_percentage=100.0,
                )
                on_update_callback(update)
                return

            update = TranslationUpdate(
                type="status",
                message=f"Starting parallel translation of {len(chapters_to_translate)} chapters (max {self.max_concurrent_chapters} concurrent)...",
            )
            on_update_callback(update)

            with ThreadPoolExecutor(
                max_workers=self.max_concurrent_chapters
            ) as executor:
                future_to_chapter = {}
                for chapter_index, chapter_meta in chapters_to_translate:
                    if self.should_cancel.is_set():
                        break

                    future = executor.submit(
                        self._translate_chapter_with_updates,
                        chapter_meta,
                        chapter_index + 1,
                        config,
                        api_keys,
                        on_update_callback,
                    )
                    future_to_chapter[future] = (chapter_index, chapter_meta)

                for future in as_completed(future_to_chapter):
                    if self.should_cancel.is_set():
                        for f in future_to_chapter:
                            f.cancel()
                        break

                    chapter_index, chapter_meta = future_to_chapter[future]
                    chapter_number = chapter_index + 1

                    try:
                        result = future.result()
                        if result:
                            logging.debug(
                                f"Chapter {chapter_number} completed successfully"
                            )
                        else:
                            logging.debug(
                                f"Chapter {chapter_number} failed (handled in worker)"
                            )
                    except Exception as e:
                        logging.error(
                            f"Unexpected error in chapter {chapter_number}: {e}"
                        )
                        with self.chapters_lock:
                            chapter_meta["status"] = "error"
                            chapter_meta["error"] = str(e)
                            self.failed_chapters += 1

                        update = TranslationUpdate(
                            type="progress",
                            chapter_number=chapter_number,
                            status="error",
                            message=f"Chapter {chapter_number} failed: {str(e)}",
                        )
                        on_update_callback(update)

            if not self.should_cancel.is_set():
                self._save_project_info()

                update = TranslationUpdate(
                    type="complete",
                    message=f"Parallel translation complete! {self.completed_chapters} chapters completed, {self.failed_chapters} failed.\nFiles saved to: {self.project_dir}",
                    progress_percentage=100.0,
                )
                on_update_callback(update)
            else:
                update = TranslationUpdate(
                    type="status", message="Translation cancelled"
                )
                on_update_callback(update)

        except Exception as e:
            logging.error(f"Translation worker error: {e}")
            update = TranslationUpdate(
                type="error", error=f"Translation error: {str(e)}"
            )
            on_update_callback(update)

        finally:
            self.is_running = False

    def _translate_chapter_with_updates(
        self,
        chapter_meta: dict,
        chapter_number: int,
        config: dict,
        api_keys: dict,
        on_update_callback: Callable[[TranslationUpdate], None],
    ) -> bool:
        """
        Translate a single chapter and handle all updates.
        Returns True if successful, False if failed.
        """
        try:
            while not self.is_paused.is_set():
                if self.should_cancel.is_set():
                    return False
                time.sleep(0.1)

            if self.should_cancel.is_set():
                return False

            with self.chapters_lock:
                chapter_meta["status"] = "in_progress"

            update = TranslationUpdate(
                type="progress",
                chapter_number=chapter_number,
                status="in_progress",
                message=f"Translating chapter {chapter_number}...",
            )
            on_update_callback(update)

            result = self._translate_chapter(chapter_meta, config, api_keys)

            with self.chapters_lock:
                if result.success:
                    chapter_meta["translated_text"] = result.text
                    chapter_meta["status"] = "completed"
                    chapter_meta["model_used"] = result.model_used
                    self.completed_chapters += 1

                    self._save_chapter_files(chapter_meta, chapter_number)

                    progress_percentage = (
                        self.completed_chapters / self.total_chapters
                    ) * 100

                    update = TranslationUpdate(
                        type="progress",
                        chapter_number=chapter_number,
                        status="completed",
                        message=f"Chapter {chapter_number} completed using {result.model_used}",
                        progress_percentage=progress_percentage,
                    )
                    on_update_callback(update)
                    return True
                else:
                    chapter_meta["status"] = "error"
                    chapter_meta["error"] = result.error_message
                    self.failed_chapters += 1

                    update = TranslationUpdate(
                        type="progress",
                        chapter_number=chapter_number,
                        status="error",
                        message=f"Chapter {chapter_number} failed: {result.error_message}",
                    )
                    on_update_callback(update)
                    return False

        except Exception as e:
            logging.error(f"Error translating chapter {chapter_number}: {e}")
            with self.chapters_lock:
                chapter_meta["status"] = "error"
                chapter_meta["error"] = str(e)
                self.failed_chapters += 1
            return False

    def _translate_chapter(
        self, chapter_meta: dict, config: dict, api_keys: dict
    ) -> TranslationResult:
        """Translate a single chapter."""
        original_text = chapter_meta.get("original_text", "")
        if not original_text:
            return TranslationResult(
                success=False, error_message="No original text found"
            )

        return self.translator.translate(
            text=original_text,
            config=config,
            openai_key=api_keys.get("openai_api_key"),
            gemini_key=api_keys.get("gemini_api_key"),
        )

    def _load_api_keys(self) -> dict:
        """Load API keys from keyring."""
        return {
            "openai_api_key": keyring.get_password(APP_SERVICE_NAME, "openai_api_key"),
            "gemini_api_key": keyring.get_password(APP_SERVICE_NAME, "gemini_api_key"),
        }

    def get_status(self) -> dict:
        """Get current translation status."""
        return {
            "is_running": self.is_running,
            "is_paused": not self.is_paused.is_set() if self.is_running else False,
            "current_chapter": self.current_chapter,
            "total_chapters": self.total_chapters,
            "completed_chapters": self.completed_chapters,
            "failed_chapters": self.failed_chapters,
            "progress_percentage": (self.completed_chapters / self.total_chapters * 100)
            if self.total_chapters > 0
            else 0,
        }

    def _setup_project_directory(self) -> bool:
        """Setup the project directory structure for saving files."""
        try:
            projects_root = Path("projects")
            projects_root.mkdir(exist_ok=True)

            book_title = self.app_state.epub_data.get("title", "Unknown_Book")
            safe_title = self._sanitize_filename(book_title)

            import datetime

            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            project_name = f"{safe_title}_{timestamp}"

            self.project_dir = projects_root / project_name
            self.project_dir.mkdir(exist_ok=True)

            self.chapters_dir = self.project_dir / "chapters"
            self.chapters_dir.mkdir(exist_ok=True)

            logging.info(f"Created project directory: {self.project_dir}")
            return True

        except Exception as e:
            logging.error(f"Failed to create project directory: {e}")
            return False

    def _sanitize_filename(self, filename: str) -> str:
        """Sanitize a string to be safe for use as a filename."""
        safe_name = re.sub(r'[<>:"/\\|?*]', "_", filename)
        safe_name = re.sub(r"_+", "_", safe_name)
        safe_name = safe_name.strip("_ ")
        if len(safe_name) > 50:
            safe_name = safe_name[:50]
        return safe_name or "Unknown"

    def _save_chapter_files(self, chapter_meta: dict, chapter_number: int):
        """Save both original and translated chapter content to files."""
        try:
            chapter_num_str = f"{chapter_number:03d}"

            original_file = (
                self.chapters_dir / f"chapter_{chapter_num_str}_original.txt"
            )
            with open(original_file, "w", encoding="utf-8") as f:
                f.write(f"Chapter {chapter_number}\n")
                f.write("=" * 50 + "\n\n")
                f.write(chapter_meta.get("original_text", ""))

            translated_file = (
                self.chapters_dir / f"chapter_{chapter_num_str}_translated.txt"
            )
            with open(translated_file, "w", encoding="utf-8") as f:
                f.write(f"Chapter {chapter_number} (Translated)\n")
                f.write("=" * 50 + "\n")
                f.write(f"Model used: {chapter_meta.get('model_used', 'Unknown')}\n")
                f.write("=" * 50 + "\n\n")
                f.write(chapter_meta.get("translated_text", ""))

            logging.info(
                f"Saved chapter {chapter_number} files: {original_file.name}, {translated_file.name}"
            )

        except Exception as e:
            logging.error(f"Failed to save chapter {chapter_number} files: {e}")

    def _save_project_info(self):
        """Save project metadata and summary."""
        try:
            project_info = {
                "book_title": self.app_state.epub_data.get("title", "Unknown"),
                "book_author": self.app_state.epub_data.get("author", "Unknown"),
                "total_chapters": self.total_chapters,
                "completed_chapters": self.completed_chapters,
                "failed_chapters": self.failed_chapters,
                "translation_config": self.app_state.active_config_name,
                "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
                "chapters_info": [],
            }

            for i, chapter_meta in enumerate(self.app_state.epub_data["chapters_meta"]):
                chapter_info = {
                    "number": i + 1,
                    "status": chapter_meta.get("status", "pending"),
                    "model_used": chapter_meta.get("model_used"),
                    "title_preview": chapter_meta.get("title_source", "")[:100],
                }
                project_info["chapters_info"].append(chapter_info)

            info_file = self.project_dir / "project_info.json"
            with open(info_file, "w", encoding="utf-8") as f:
                json.dump(project_info, f, indent=2, ensure_ascii=False)

            readme_file = self.project_dir / "README.txt"
            with open(readme_file, "w", encoding="utf-8") as f:
                f.write(f"Translation Project: {project_info['book_title']}\n")
                f.write(f"Author: {project_info['book_author']}\n")
                f.write(f"Created: {project_info['created_at']}\n")
                f.write(f"Configuration: {project_info['translation_config']}\n\n")
                f.write(
                    f"Progress: {self.completed_chapters}/{self.total_chapters} chapters completed\n"
                )
                f.write(f"Failed: {self.failed_chapters} chapters\n\n")
                f.write("Files:\n")
                f.write("- chapters/: Contains original and translated chapter files\n")
                f.write("- project_info.json: Detailed project metadata\n\n")
                f.write("Translated chapters are saved as:\n")
                f.write("- chapter_001_original.txt, chapter_001_translated.txt\n")
                f.write("- chapter_002_original.txt, chapter_002_translated.txt\n")
                f.write("- etc.\n")

            logging.info(f"Saved project info to {info_file}")

        except Exception as e:
            logging.error(f"Failed to save project info: {e}")

    def set_max_concurrent_chapters(self, max_concurrent: int):
        """Set the maximum number of chapters to translate concurrently."""
        if 1 <= max_concurrent <= 10:
            self.max_concurrent_chapters = max_concurrent
            logging.info(f"Set max concurrent chapters to: {max_concurrent}")
        else:
            logging.warning(
                f"Invalid concurrency value: {max_concurrent}. Using default."
            )

    def get_project_directory(self) -> Optional[str]:
        """Get the current project directory path."""
        return str(self.project_dir) if self.project_dir else None
