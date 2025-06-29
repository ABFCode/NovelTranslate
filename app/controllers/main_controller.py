import logging

import flet as ft
from flet import FilePickerResultEvent

from app.controllers.api_key_controller import ApiKeyController
from app.core.app_state import AppState
from app.core.config_manager import ConfigManager
from app.core.epub_parser import parse_epub
from app.core.translation_orchestrator import TranslationOrchestrator, TranslationUpdate
from app.ui.config_dialog import ConfigDialog
from app.ui.manage_configs_dialog import ManageConfigsDialog
from app.ui.novel_project_view import create_chapter_item


class MainController:
    """Main application controller - coordinates between different modules."""

    def __init__(
        self, page: ft.Page, app_state: AppState, config_manager: ConfigManager
    ):
        self.page = page
        self.app_state = app_state
        self.config_manager = config_manager

        # Sub-controllers
        self.api_key_controller = ApiKeyController(page)
        self.translation_orchestrator = TranslationOrchestrator(
            app_state, config_manager
        )

        # Current view controls (set by route handlers)
        self.view_controls = None

    def set_view_controls(self, view_controls):
        """Set the current view controls."""
        self.view_controls = view_controls
        # Also set for sub-controllers that need it
        if hasattr(view_controls, "key_control_sets"):
            self.api_key_controller.set_view_controls(view_controls)

    # ========== EPUB File Handling ==========

    def handle_file_picker_result(self, e: FilePickerResultEvent):
        """Handle EPUB file selection and parsing."""
        if not self.view_controls:
            return

        self.view_controls.selected_epub_path_text.value = "Processing..."
        self.view_controls.output_log_field.value = ""

        # Reset EPUB data
        self.app_state.reset_epub_data()
        self._update_epub_ui()
        self.page.update()

        if not e.files:
            self.view_controls.selected_epub_path_text.value = (
                "File selection cancelled."
            )
            self.page.update()
            return

        selected_file_path = e.files[0].path
        self.view_controls.selected_epub_path_text.value = (
            f"Selected: {selected_file_path}"
        )
        logging.info(f"File Selected: {selected_file_path}")

        # Parse EPUB
        success, result = parse_epub(selected_file_path)

        if success:
            self._process_successful_epub_parse(result, selected_file_path)
        else:
            self._handle_epub_parse_error(result)

        self.page.update()

    def _process_successful_epub_parse(self, chapter_texts: list, file_path: str):
        """Process successfully parsed EPUB data."""
        # Create chapter metadata
        for i, chap_text in enumerate(chapter_texts):
            snippet = chap_text[:70].replace("\n", " ").strip()
            self.app_state.epub_data["chapters_meta"].append(
                {
                    "number": i + 1,
                    "title_source": snippet,
                    "original_text": chap_text,
                    "translated_text": None,
                    "status": "pending",
                }
            )

        # Extract metadata
        try:
            from ebooklib import epub

            book = epub.read_epub(file_path)
            title_meta = book.get_metadata("DC", "title")
            author_meta = book.get_metadata("DC", "creator")
            if title_meta:
                self.app_state.epub_data["title"] = title_meta[0][0]
            if author_meta:
                self.app_state.epub_data["author"] = author_meta[0][0]
        except Exception as meta_ex:
            logging.warning(f"Could not extract metadata: {meta_ex}")

        # Update UI
        self._update_epub_ui()
        self._populate_chapter_list()

        # Create success log message
        log_message = (
            f"Successfully parsed EPUB: {self.app_state.epub_data['title']}.\n"
            f"Found {len(self.app_state.epub_data['chapters_meta'])} chapters.\n"
        )
        if self.app_state.epub_data["chapters_meta"]:
            first_chapter = self.app_state.epub_data["chapters_meta"][0][
                "original_text"
            ]
            log_message += f"\nFirst chapter preview:\n---\n{first_chapter[:200]}..."

        self.view_controls.output_log_field.value = log_message

    def _handle_epub_parse_error(self, error_result):
        """Handle EPUB parsing errors."""
        error_message = (
            error_result if isinstance(error_result, str) else "Unknown parsing error."
        )
        self.view_controls.selected_epub_path_text.value = (
            "Error parsing file (see log)"
        )
        self.view_controls.output_log_field.value = f"Error: {error_message}"

    def _update_epub_ui(self):
        """Update EPUB-related UI elements."""
        if not self.view_controls:
            return

        self.view_controls.epub_title_text.value = self.app_state.epub_data["title"]
        self.view_controls.epub_author_text.value = self.app_state.epub_data["author"]
        self.view_controls.chapter_count_text.value = str(
            len(self.app_state.epub_data["chapters_meta"])
        )

    def _populate_chapter_list(self):
        """Populate the chapter list view."""
        if not self.view_controls or not self.view_controls.chapter_list_view:
            return

        self.view_controls.chapter_list_view.controls.clear()
        for chap_meta in self.app_state.epub_data["chapters_meta"]:
            self.view_controls.chapter_list_view.controls.append(
                create_chapter_item(
                    chapter_number=chap_meta["number"],
                    chapter_title=chap_meta["title_source"],
                    status=chap_meta["status"],
                )
            )

    # ========== Configuration Management ==========

    def on_config_saved_or_deleted(self):
        """Handle configuration changes."""
        logging.info("Configuration saved. Refreshing UI elements")
        self.update_active_config_dropdown()

    def open_create_config_dialog(self, e):
        """Open dialog to create a new configuration."""
        create_dialog = ConfigDialog(
            self.config_manager, on_save_callback=self.on_config_saved_or_deleted
        )
        self.page.open(create_dialog)

    def open_edit_config_dialog(self, config_name: str):
        """Open dialog to edit an existing configuration."""
        config_to_edit = self.config_manager.get_config(config_name)
        if not config_to_edit:
            logging.error(f"Could not find config '{config_name}' to edit")
            return

        edit_dialog = ConfigDialog(
            self.config_manager,
            on_save_callback=self.on_config_saved_or_deleted,
            config_to_edit=config_to_edit,
        )
        self.page.open(edit_dialog)

    def open_manage_configs_dialog(self, e):
        """Open the manage configurations dialog."""
        manage_dialog = ManageConfigsDialog(
            self.config_manager,
            on_close_callback=self.on_config_saved_or_deleted,
            on_add_new_callback=self.open_create_config_dialog,
            on_edit_callback=self.open_edit_config_dialog,
        )
        self.page.open(manage_dialog)

    def update_active_config_dropdown(self):
        """Update the active configuration dropdown."""
        if not self.view_controls or not hasattr(
            self.view_controls, "active_config_dropdown"
        ):
            return

        dropdown = self.view_controls.active_config_dropdown
        current_value = dropdown.value
        all_configs = self.config_manager.get_all_configs()

        dropdown.options.clear()
        for name in all_configs.keys():
            dropdown.options.append(ft.dropdown.Option(name))

        # Preserve selection if still valid
        new_options = [opt.key for opt in dropdown.options]
        if current_value in new_options:
            dropdown.value = current_value
        else:
            dropdown.value = self.app_state.active_config_name

        self.page.update()

    def on_active_config_change(self, e):
        """Handle active configuration change."""
        self.app_state.active_config_name = e.control.value
        logging.info(
            f"Active configuration changed to: {self.app_state.active_config_name}"
        )

    # ========== Translation Management ==========

    def start_translation(self, e):
        """Start the translation process."""
        if not self.app_state.active_config_name:
            self._show_error("Please select a configuration first.")
            return

        if not self.app_state.epub_data["chapters_meta"]:
            self._show_error("Please load an EPUB file first.")
            return

        if not self.api_key_controller.has_any_keys():
            self._show_error("Please set up at least one API key in Settings.")
            return

        # Update UI state
        self._set_translation_ui_state(translating=True)

        # Start translation
        success = self.translation_orchestrator.start_translation(
            self._handle_translation_update
        )
        if not success:
            self._set_translation_ui_state(translating=False)

    def pause_translation(self, e):
        """Pause the translation process."""
        self.translation_orchestrator.pause_translation()
        self._update_translation_buttons()

    def resume_translation(self, e):
        """Resume the translation process."""
        self.translation_orchestrator.resume_translation()
        self._update_translation_buttons()

    def cancel_translation(self, e):
        """Cancel the translation process."""
        self.translation_orchestrator.cancel_translation()
        self._set_translation_ui_state(translating=False)

    def _handle_translation_update(self, update: TranslationUpdate):
        """Handle translation updates from the orchestrator."""
        if not self.view_controls:
            return

        try:
            logging.info(
                f"Received translation update: {update.type} - {update.message}"
            )

            if update.type == "progress":
                self._handle_progress_update(update)
            elif update.type == "log":
                self._add_log_message(update.message)
            elif update.type == "status":
                self._update_status(update.message)
            elif update.type == "complete":
                self._handle_translation_complete(update)
            elif update.type == "error":
                self._handle_translation_error(update)

            # Force UI update
            self.page.update()

        except Exception as e:
            logging.error(f"Error handling translation update: {e}")
            import traceback

            traceback.print_exc()

    def _handle_progress_update(self, update: TranslationUpdate):
        """Handle progress updates."""
        if update.chapter_number and update.status:
            # Update specific chapter in the list
            self._update_chapter_status(update.chapter_number, update.status)

        if update.progress_percentage is not None:
            self.view_controls.overall_progress_bar.value = (
                update.progress_percentage / 100
            )

        if update.message:
            self._add_log_message(update.message)

    def _handle_translation_complete(self, update: TranslationUpdate):
        """Handle translation completion."""
        self._set_translation_ui_state(translating=False)
        self._add_log_message(update.message)
        self.view_controls.export_novel_button.disabled = False

        # Show completion notification
        self.page.open(
            ft.SnackBar(
                content=ft.Text("Translation completed!"), bgcolor=ft.colors.GREEN_700
            )
        )

    def _handle_translation_error(self, update: TranslationUpdate):
        """Handle translation errors."""
        self._set_translation_ui_state(translating=False)
        self._add_log_message(f"ERROR: {update.error}")
        self._show_error(update.error)

    def _update_chapter_status(self, chapter_number: int, status: str):
        """Update the status of a specific chapter in the UI."""
        if not self.view_controls or not self.view_controls.chapter_list_view:
            return

        # Find and update the chapter item
        chapter_index = chapter_number - 1
        if 0 <= chapter_index < len(self.view_controls.chapter_list_view.controls):
            # Update the app state
            if chapter_index < len(self.app_state.epub_data["chapters_meta"]):
                self.app_state.epub_data["chapters_meta"][chapter_index]["status"] = (
                    status
                )

            # Recreate the chapter item with new status
            chap_meta = self.app_state.epub_data["chapters_meta"][chapter_index]
            new_item = create_chapter_item(
                chapter_number=chap_meta["number"],
                chapter_title=chap_meta["title_source"],
                status=status,
            )
            self.view_controls.chapter_list_view.controls[chapter_index] = new_item

    def _set_translation_ui_state(self, translating: bool):
        """Update UI elements based on translation state."""
        if not self.view_controls:
            return

        self.view_controls.start_translation_button.disabled = translating
        self.view_controls.pause_translation_button.disabled = not translating
        self.view_controls.cancel_translation_button.disabled = not translating

        status_text = "Status: Translating..." if translating else "Status: Idle"
        self.view_controls.translation_status_text.value = status_text

        self._update_translation_buttons()

    def _update_translation_buttons(self):
        """Update translation control buttons based on current state."""
        if not self.view_controls:
            return

        status = self.translation_orchestrator.get_status()
        if status["is_running"]:
            if status["is_paused"]:
                self.view_controls.pause_translation_button.text = "Resume"
                self.view_controls.pause_translation_button.on_click = (
                    self.resume_translation
                )
            else:
                self.view_controls.pause_translation_button.text = "Pause"
                self.view_controls.pause_translation_button.on_click = (
                    self.pause_translation
                )

    def _add_log_message(self, message: str):
        """Add a message to the output log."""
        if self.view_controls and self.view_controls.output_log_field:
            current_log = self.view_controls.output_log_field.value or ""
            self.view_controls.output_log_field.value = current_log + "\n" + message

    def _update_status(self, message: str):
        """Update the status text."""
        if self.view_controls and self.view_controls.translation_status_text:
            self.view_controls.translation_status_text.value = f"Status: {message}"

    def _show_error(self, error_message: str):
        """Show an error message to the user."""
        self.page.open(
            ft.SnackBar(content=ft.Text(error_message), bgcolor=ft.colors.RED_700)
        )

    # ========== API Key Management (Delegate to ApiKeyController) ==========

    def load_api_keys(self, e=None):
        """Load API keys (delegate to ApiKeyController)."""
        self.api_key_controller.load_api_keys(e)

    def show_edit_mode(self, e, key_name: str):
        """Show edit mode for API key (delegate to ApiKeyController)."""
        self.api_key_controller.show_edit_mode(e, key_name)

    def cancel_edit_mode(self, e, key_name: str):
        """Cancel edit mode for API key (delegate to ApiKeyController)."""
        self.api_key_controller.cancel_edit_mode(e, key_name)

    def save_key(self, e, key_name: str):
        """Save API key (delegate to ApiKeyController)."""
        self.api_key_controller.save_key(e, key_name)

    def delete_key(self, e, key_name: str):
        """Delete API key (delegate to ApiKeyController)."""
        self.api_key_controller.delete_key(e, key_name)
