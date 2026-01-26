import logging

import flet as ft
import keyring

from app.core.constants import APP_SERVICE_NAME


class ApiKeyController:
    """Handles all API key management operations."""

    def __init__(self, page: ft.Page):
        self.page = page
        self.loaded_api_keys = {}
        self.view_controls = None

    def set_view_controls(self, view_controls):
        """Set reference to the settings view controls."""
        self.view_controls = view_controls

    def _get_key_controls(self, key_name: str) -> dict:
        """Get the UI controls for a specific API key."""
        if not self.view_controls:
            return {}
        return self.view_controls.key_control_sets.get(key_name, {})

    def _obscure_key(self, key: str | None) -> str:
        """Obscure an API key for display."""
        if not key or len(key) < 8:
            return ""
        return f"{key[:4]}...{key[-4:]}"

    def load_api_keys(self, e=None):
        """Load all API keys from keyring and update UI."""
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
        """Switch to edit mode for a specific API key."""
        key_controls = self._get_key_controls(key_name)
        if not key_controls:
            return

        key_controls["display_row"].visible = False
        key_controls["edit_row"].visible = True
        key_controls["edit_field"].value = ""
        self.page.update()
        key_controls["edit_field"].focus()

    def cancel_edit_mode(self, e, key_name: str):
        """Cancel edit mode and return to display mode."""
        key_controls = self._get_key_controls(key_name)
        if not key_controls:
            return

        key_controls["edit_row"].visible = False
        key_controls["display_row"].visible = True
        self.page.update()

    def save_key(self, e, key_name: str):
        """Save a new or updated API key."""
        key_controls = self._get_key_controls(key_name)
        if not key_controls:
            return

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

        self.cancel_edit_mode(e, key_name)
        self.load_api_keys()

    def delete_key(self, e, key_name: str):
        """Show confirmation dialog for deleting an API key."""
        display_name = key_name.split("_")[0].capitalize()
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
                    on_click=lambda ev: self._confirm_delete_key(
                        ev, key_name, confirm_dialog
                    ),
                ),
                ft.TextButton(
                    "Cancel", on_click=lambda _: self.page.close(confirm_dialog)
                ),
            ],
            actions_alignment=ft.MainAxisAlignment.END,
        )
        self.page.open(confirm_dialog)

    def _confirm_delete_key(self, e, key_name: str, dialog_to_close: ft.AlertDialog):
        """Actually delete the API key after confirmation."""
        keyring.delete_password(APP_SERVICE_NAME, key_name)
        logging.info(f"{key_name} has been deleted.")
        self.page.close(dialog_to_close)
        self.page.open(ft.SnackBar(content=ft.Text("Key deleted.")))
        self.load_api_keys()

    def get_all_keys(self) -> dict:
        """Get all loaded API keys."""
        return self.loaded_api_keys.copy()

    def has_key(self, key_name: str) -> bool:
        """Check if a specific API key is available."""
        return bool(self.loaded_api_keys.get(key_name))

    def has_any_keys(self) -> bool:
        """Check if any API keys are available."""
        return any(self.loaded_api_keys.values())
