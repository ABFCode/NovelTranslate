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
        self.loaded_api_keys = {}

    def _get_key_controls(self, key_name: str) -> dict:
        if not self.view_controls:
            return {}
        return self.view_controls.key_control_sets.get(key_name, {})

    def _obscure_key(self, key: str | None) -> str:
        if not key or len(key) < 8:
            return ""
        return f"{key[:4]}...{key[-4:]}"

    def load_api_keys(self, e=None):
        logging.info("Loading API keys from keyring...")
        key_definitions = ["openai_api_key", "gemini_api_key"]

        for key_name in key_definitions:
            key_value = keyring.get_password(APP_SERVICE_NAME, key_name)
            self.loaded_api_keys[key_name] = key_value

            key_controls = self._get_key_controls(key_name)
            if not key_controls:
                continue

            display_name = key_name.split("_")[0].capitalize()
            if key_value:
                key_controls[
                    "display_text"
                ].value = f"{display_name} Key: {self._obscure_key(key_value)}"
                key_controls["display_text"].italic = False
                key_controls["delete_button"].visible = True
            else:
                key_controls["display_text"].value = f"{display_name} Key: Not set"
                key_controls["display_text"].italic = True
                key_controls["delete_button"].visible = False

        if self.page:
            self.page.update()

    def show_edit_mode(self, e, key_name: str):
        key_controls = self._get_key_controls(key_name)
        key_controls["display_row"].visible = False
        key_controls["edit_row"].visible = True
        key_controls["edit_field"].value = ""  # Clear the field
        self.page.update()
        key_controls["edit_field"].focus()

    # NEW METHOD
    def cancel_edit_mode(self, e, key_name: str):
        key_controls = self._get_key_controls(key_name)
        key_controls["edit_row"].visible = False
        key_controls["display_row"].visible = True
        self.page.update()

    # REPLACES old save_api_keys
    def save_key(self, e, key_name: str):
        key_controls = self._get_key_controls(key_name)
        new_key_value = key_controls["edit_field"].value

        if new_key_value:
            keyring.set_password(APP_SERVICE_NAME, key_name, new_key_value)
            logging.info(f"{key_name} has been updated.")
            self.page.open(
                ft.SnackBar(
                    content=ft.Text("Key saved successfully!"),
                    bgcolor=ft.colors.GREEN_700,
                )
            )

        # Revert to display mode and reload all keys to show the change
        self.cancel_edit_mode(e, key_name)
        self.load_api_keys()

    # NEW METHOD for handling delete confirmation
    def _confirm_delete_key(self, e, key_name: str):
        keyring.delete_password(APP_SERVICE_NAME, key_name)
        logging.info(f"{key_name} has been deleted.")
        self.page.dialog.open = False
        self.page.open(ft.SnackBar(content=ft.Text("Key deleted.")))
        self.load_api_keys()  # Refresh the UI

    # NEW METHOD to open delete dialog
    def delete_key(self, e, key_name: str):
        display_name = key_name.split("_")[0].capitalize()

        def on_confirm_delete(ev):
            self._confirm_delete_key(ev, key_name)

        confirm_dialog = ft.AlertDialog(
            modal=True,
            title=ft.Text("Confirm Deletion"),
            content=ft.Text(
                f"Are you sure you want to delete the {display_name} API key? This cannot be undone."
            ),
            actions=[
                ft.ElevatedButton(
                    "Yes, delete it",
                    color=ft.colors.WHITE,
                    bgcolor=ft.colors.RED_700,
                    on_click=on_confirm_delete,
                ),
                ft.TextButton(
                    "Cancel", on_click=lambda _: self.page.close(confirm_dialog)
                ),
            ],
            actions_alignment=ft.MainAxisAlignment.END,
        )
        self.page.open(confirm_dialog)

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
