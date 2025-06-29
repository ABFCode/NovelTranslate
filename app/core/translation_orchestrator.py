import json
import logging
import queue
import re
import threading
import time
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

        # Thread control
        self.is_running = False
        self.is_paused = threading.Event()
        self.is_paused.set()  # Initially not paused
        self.should_cancel = threading.Event()
        self.translation_thread = None

        # UI Communication
        self.ui_update_queue = queue.Queue()

        # Status tracking
        self.current_chapter = 0
        self.total_chapters = 0
        self.completed_chapters = 0
        self.failed_chapters = 0

        # Project management
        self.project_dir = None
        self.chapters_dir = None

    def start_translation(
        self, on_update_callback: Callable[[TranslationUpdate], None]
    ):
        """Start the translation process in a background thread."""
        if self.is_running:
            logging.warning("Translation already running")
            return False

        if not self.app_state.active_config_name:
            self._send_update(
                TranslationUpdate(
                    type="error", error="No active configuration selected"
                )
            )
            return False

        if not self.app_state.epub_data["chapters_meta"]:
            self._send_update(TranslationUpdate(type="error", error="No EPUB loaded"))
            return False

        # Reset state
        self.is_running = True
        self.should_cancel.clear()
        self.is_paused.set()
        self.current_chapter = 0
        self.total_chapters = len(self.app_state.epub_data["chapters_meta"])
        self.completed_chapters = 0
        self.failed_chapters = 0

        # Setup project directory
        if not self._setup_project_directory():
            on_update_callback(
                TranslationUpdate(
                    type="error", error="Failed to create project directory"
                )
            )
            return False

        # Start background thread
        self.translation_thread = threading.Thread(
            target=self._translation_worker, args=(on_update_callback,), daemon=True
        )
        self.translation_thread.start()
        return True

    def pause_translation(self):
        """Pause the translation process."""
        if self.is_running:
            self.is_paused.clear()
            self._send_update(
                TranslationUpdate(type="status", message="Translation paused")
            )

    def resume_translation(self):
        """Resume the translation process."""
        if self.is_running:
            self.is_paused.set()
            self._send_update(
                TranslationUpdate(type="status", message="Translation resumed")
            )

    def cancel_translation(self):
        """Cancel the translation process."""
        if self.is_running:
            self.should_cancel.set()
            self.is_paused.set()  # Unblock if paused
            self._send_update(
                TranslationUpdate(type="status", message="Cancelling translation...")
            )

    def _translation_worker(
        self, on_update_callback: Callable[[TranslationUpdate], None]
    ):
        """Main translation loop running in background thread."""
        try:
            update = TranslationUpdate(type="status", message="Starting translation...")
            on_update_callback(update)

            # Get configuration
            config = self.config_manager.get_config(self.app_state.active_config_name)
            if not config:
                update = TranslationUpdate(
                    type="error", error="Configuration not found"
                )
                on_update_callback(update)
                return

            # Get API keys
            api_keys = self._load_api_keys()

            chapters = self.app_state.epub_data["chapters_meta"]

            for i, chapter_meta in enumerate(chapters):
                # Check for cancellation
                if self.should_cancel.is_set():
                    update = TranslationUpdate(
                        type="status", message="Translation cancelled"
                    )
                    on_update_callback(update)
                    break

                # Wait if paused
                self.is_paused.wait()

                # Skip if already completed
                if chapter_meta.get("status") == "completed":
                    self.completed_chapters += 1
                    continue

                self.current_chapter = i + 1

                # Update chapter status to in_progress
                chapter_meta["status"] = "in_progress"
                update = TranslationUpdate(
                    type="progress",
                    chapter_number=self.current_chapter,
                    status="in_progress",
                    message=f"Translating chapter {self.current_chapter}/{self.total_chapters}...",
                )
                on_update_callback(update)

                # Perform translation
                result = self._translate_chapter(chapter_meta, config, api_keys)

                if result.success:
                    chapter_meta["translated_text"] = result.text
                    chapter_meta["status"] = "completed"
                    chapter_meta["model_used"] = result.model_used
                    self.completed_chapters += 1

                    # Save the translated chapter to file
                    self._save_chapter_files(chapter_meta, self.current_chapter)

                    update = TranslationUpdate(
                        type="progress",
                        chapter_number=self.current_chapter,
                        status="completed",
                        message=f"Chapter {self.current_chapter} completed using {result.model_used} (saved to {self.chapters_dir})",
                        progress_percentage=(
                            self.completed_chapters / self.total_chapters
                        )
                        * 100,
                    )
                    on_update_callback(update)
                else:
                    chapter_meta["status"] = "error"
                    chapter_meta["error"] = result.error_message
                    self.failed_chapters += 1

                    update = TranslationUpdate(
                        type="progress",
                        chapter_number=self.current_chapter,
                        status="error",
                        message=f"Chapter {self.current_chapter} failed: {result.error_message}",
                    )
                    on_update_callback(update)

                # Brief pause between chapters
                if not self.should_cancel.is_set():
                    time.sleep(1)

            # Translation complete
            if not self.should_cancel.is_set():
                # Save project info
                self._save_project_info()

                update = TranslationUpdate(
                    type="complete",
                    message=f"Translation complete! {self.completed_chapters} chapters completed, {self.failed_chapters} failed.\nFiles saved to: {self.project_dir}",
                    progress_percentage=100.0,
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

    def _send_update(self, update: TranslationUpdate):
        """Send update to UI queue."""
        self.ui_update_queue.put(update)

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
            # Create main projects directory
            projects_root = Path("projects")
            projects_root.mkdir(exist_ok=True)

            # Sanitize book title for directory name
            book_title = self.app_state.epub_data.get("title", "Unknown_Book")
            safe_title = self._sanitize_filename(book_title)

            # Create project directory (with timestamp to avoid conflicts)
            import datetime

            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            project_name = f"{safe_title}_{timestamp}"

            self.project_dir = projects_root / project_name
            self.project_dir.mkdir(exist_ok=True)

            # Create chapters subdirectory
            self.chapters_dir = self.project_dir / "chapters"
            self.chapters_dir.mkdir(exist_ok=True)

            logging.info(f"Created project directory: {self.project_dir}")
            return True

        except Exception as e:
            logging.error(f"Failed to create project directory: {e}")
            return False

    def _sanitize_filename(self, filename: str) -> str:
        """Sanitize a string to be safe for use as a filename."""
        # Remove invalid characters and replace with underscores
        safe_name = re.sub(r'[<>:"/\\|?*]', "_", filename)
        # Remove multiple consecutive underscores
        safe_name = re.sub(r"_+", "_", safe_name)
        # Remove leading/trailing underscores and spaces
        safe_name = safe_name.strip("_ ")
        # Limit length
        if len(safe_name) > 50:
            safe_name = safe_name[:50]
        return safe_name or "Unknown"

    def _save_chapter_files(self, chapter_meta: dict, chapter_number: int):
        """Save both original and translated chapter content to files."""
        try:
            chapter_num_str = f"{chapter_number:03d}"  # e.g., "001", "002"

            # Save original chapter
            original_file = (
                self.chapters_dir / f"chapter_{chapter_num_str}_original.txt"
            )
            with open(original_file, "w", encoding="utf-8") as f:
                f.write(f"Chapter {chapter_number}\n")
                f.write("=" * 50 + "\n\n")
                f.write(chapter_meta.get("original_text", ""))

            # Save translated chapter
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

            # Add info about each chapter
            for i, chapter_meta in enumerate(self.app_state.epub_data["chapters_meta"]):
                chapter_info = {
                    "number": i + 1,
                    "status": chapter_meta.get("status", "pending"),
                    "model_used": chapter_meta.get("model_used"),
                    "title_preview": chapter_meta.get("title_source", "")[:100],
                }
                project_info["chapters_info"].append(chapter_info)

            # Save project info
            info_file = self.project_dir / "project_info.json"
            with open(info_file, "w", encoding="utf-8") as f:
                json.dump(project_info, f, indent=2, ensure_ascii=False)

            # Save a README for easy access
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

    def get_project_directory(self) -> Optional[str]:
        """Get the current project directory path."""
        return str(self.project_dir) if self.project_dir else None
