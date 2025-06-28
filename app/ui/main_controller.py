import logging

import flet as ft
import keyring
from flet import FilePickerResultEvent

from app.core.app_state import AppState
from app.core.config_manager import ConfigManager
from app.core.constants import APP_SERVICE_NAME
from app.core.epub_parser import parse_epub
from app.ui.config_dialog import ConfigDialog
from app.ui.manage_configs_dialog import ManageConfigsDialog
from app.ui.novel_project_view import create_chapter_item


class AppController:
    def __init__(
        self,
        page: ft.Page,
        app_state: AppState,
        config_manager: ConfigManager,
    ):
        self.page = page
        self.app_state = app_state
        self.config_manager = config_manager
        self.view_controls = None

    def save_api_keys(self, e):
        """
        Retriees API keys from the settings views text fields and saves them to the
        systems keyring.
        """
        try:
            openai_key = self.view_controls.openai_key_field.value
            gemini_key = self.view_controls.gemini_key_field.value

            if openai_key:
                keyring.set_password(APP_SERVICE_NAME, "openai_api_key", openai_key)
                logging.info("OpenAI Api key has been stored")

            if gemini_key:
                keyring.set_password(APP_SERVICE_NAME, "gemini_api_key", gemini_key)
                logging.info("Gemini API key has been stored")

            feedback_snackbar = ft.SnackBar(
                content=ft.Text("API keys saved"),
                bgcolor=ft.colors.GREEN_700,
            )
            self.page.open(feedback_snackbar)
        except Exception as e:
            logging.error(f"Failed to save API keys: {e}")

            error_snackbar = ft.SnackBar(
                content=ft.Text(f"Error saving keys: {e}", color=ft.colors.WHITE),
                bgcolor=ft.colors.RED_700,
            )
            self.page.open(error_snackbar)

    def _obscure_key(self, key: str) -> str:
        if not key or len(key) < 8:
            return ""
        return f"{key[:4]}...{key[-4:]}"

    def load_api_keys(self, e=None):
        """
        Loads API keys from the keyring and populates the corresponding settings fields
        """

        logging.info("Loading API keys from keyring")

        openai_key = keyring.get_password(APP_SERVICE_NAME, "openai_api_key")
        gemini_key = keyring.get_password(APP_SERVICE_NAME, "gemini_api_key")

        if self.view_controls:
            self.view_controls.openai_key_field.value = self._obscure_key(openai_key)
            self.view_controls.gemini_key_field.value = self._obscure_key(gemini_key)

        if openai_key:
            self.view_controls.openai_key_field.hint_text = (
                "A key is already set. Enter a new one to overwrite"
            )
            self.view_controls.gemini_key_field.hint_text = (
                "A key is already set. Enter a new one to overwrite"
            )
        self.page.update()
        # openai_key = keyring.get_password()

    def handle_file_picker_result(self, e: FilePickerResultEvent):
        self.view_controls.selected_epub_path_text.value = "Processing..."
        self.view_controls.output_log_field.value = ""

        self.app_state.reset_epub_data()

        self.view_controls.epub_title_text.value = self.app_state.epub_data["title"]
        self.view_controls.epub_author_text.value = self.app_state.epub_data["author"]
        self.view_controls.chapter_count_text.value = str(
            len(self.app_state.epub_data["chapters_meta"])
        )
        if self.view_controls.chapter_list_view:
            self.view_controls.chapter_list_view.controls.clear()
        self.page.update()

        if e.files:
            selected_file_path = e.files[0].path
            self.view_controls.selected_epub_path_text.value = (
                f"Selected: {selected_file_path}"
            )
            logging.info(f"File Selected: {selected_file_path}")
            success, result = parse_epub(selected_file_path)

            if success:
                raw_chapter_texts = result
                for i, chap_text in enumerate(raw_chapter_texts):
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

                try:
                    from ebooklib import epub

                    book = epub.read_epub(selected_file_path)
                    title_meta = book.get_metadata("DC", "title")
                    author_meta = book.get_metadata("DC", "creator")
                    if title_meta:
                        self.app_state.epub_data["title"] = title_meta[0][0]
                    if author_meta:
                        self.app_state.epub_data["author"] = author_meta[0][0]
                except Exception as meta_ex:
                    logging.warning(f"Could not extract metadata: {meta_ex}")

                self.view_controls.epub_title_text.value = self.app_state.epub_data[
                    "title"
                ]
                self.view_controls.epub_author_text.value = self.app_state.epub_data[
                    "author"
                ]
                self.view_controls.chapter_count_text.value = str(
                    len(self.app_state.epub_data["chapters_meta"])
                )

                log_message = f"Successfully parsed EPUB: {self.app_state.epub_data['title']}.\nFound {len(self.app_state.epub_data['chapters_meta'])} chapters.\n"
                if self.app_state.epub_data["chapters_meta"]:
                    log_message += f"\nFirst chapter preview:\n---\n{self.app_state.epub_data['chapters_meta'][0]['original_text'][:200]}..."
                    if self.view_controls.chapter_list_view:
                        self.view_controls.chapter_list_view.controls.clear()
                        for chap_meta in self.app_state.epub_data["chapters_meta"]:
                            self.view_controls.chapter_list_view.controls.append(
                                create_chapter_item(
                                    chapter_number=chap_meta["number"],
                                    chapter_title=chap_meta["title_source"],
                                    status=chap_meta["status"],
                                )
                            )
                    self.view_controls.output_log_field.value = log_message
                else:
                    self.view_controls.output_log_field.value = (
                        "Successfully parsed EPUB, but no chapter content found."
                    )
            else:
                error_message = (
                    result if isinstance(result, str) else "Unknown parsing error."
                )
                self.view_controls.selected_epub_path_text.value = (
                    "Error parsing file (see log)"
                )
                self.view_controls.output_log_field.value = f"Error: {error_message}"
        else:
            self.view_controls.selected_epub_path_text.value = (
                "File selection cancelled."
            )
        self.page.update()

    def on_config_saved_or_deleted(self):
        logging.info("Configuration saved. Refreshing UI elements")
        self.update_active_config_dropdown()

    def open_create_config_dialog(self, e):
        create_dialog = ConfigDialog(
            self.config_manager, on_save_callback=self.on_config_saved_or_deleted
        )
        self.page.open(create_dialog)

    def open_edit_config_dialog(self, config_name: str):
        config_to_edit = self.config_manager.get_config(config_name)
        if not config_to_edit:
            logging.error(f"Could not find config '{config_name} to edit")
            return
        edit_dialog = ConfigDialog(
            self.config_manager,
            on_save_callback=self.on_config_saved_or_deleted,
            config_to_edit=config_to_edit,
        )
        self.page.open(edit_dialog)

    def open_manage_configs_dialog(self, e):
        print("Manage button clicked")
        manage_dialog = ManageConfigsDialog(
            self.config_manager,
            on_close_callback=self.on_config_saved_or_deleted,
            on_add_new_callback=self.open_create_config_dialog,
            on_edit_callback=self.open_edit_config_dialog,
        )
        self.page.open(manage_dialog)

    def update_active_config_dropdown(self):
        if self.view_controls and hasattr(self.view_controls, "active_config_dropdown"):
            dropdown = self.view_controls.active_config_dropdown
            current_value = dropdown.value
            all_configs = self.config_manager.get_all_configs()

            dropdown.options.clear()  # Clear old options
            for name in all_configs.keys():
                dropdown.options.append(ft.dropdown.Option(name))

            new_options = [opt.key for opt in dropdown.options]
            if current_value in new_options:
                dropdown.value = current_value
            else:
                dropdown.value = self.app_state.active_config_name
            self.page.update()

    def on_active_config_change(self, e):
        self.app_state.active_config_name = e.control.value
        logging.info(
            f"Active configuration changed to: {self.app_state.active_config_name}"
        )

    def navigation_changed(self, e):
        pass
