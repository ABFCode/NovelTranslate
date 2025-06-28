import logging

import flet as ft

from app.core.constants import SUPPORTED_MODELS
from app.ui.fallback_item_row import FallbackItemRow


class ConfigDialog(ft.AlertDialog):
    def __init__(self, config_manager, on_save_callback, config_to_edit: dict = None):
        super().__init__()
        logging.info("--- Dialog: __init__() STARTED ---")
        self.config_manager = config_manager
        self.on_save_callback = on_save_callback
        self.config_to_edit = config_to_edit
        self.original_config_name = (
            config_to_edit.get("name") if config_to_edit else None
        )
        self.modal = True

        self.title = ft.Text(
            "Edit Configuration" if self.config_to_edit else "Create new configuration"
        )

        self.config_name_field = ft.TextField(
            label="Configuration Name",
            autofocus=True,
        )

        self.primary_llm_dropdown = ft.Dropdown(
            label="Primary LLM",
            options=[ft.dropdown.Option(model) for model in SUPPORTED_MODELS],
        )

        self.prompt_field = ft.TextField(
            label="System Prompt",
            multiline=True,
            min_lines=3,
        )

        self.fallback_list_view = ft.ListView(spacing=15, expand=True)
        self.add_fallback_button = ft.TextButton(
            "Add Fallback Step", icon=ft.Icons.ADD, on_click=self.add_fallback_clicked
        )

        self.content = ft.Column(
            [
                self.config_name_field,
                self.prompt_field,
                self.primary_llm_dropdown,
                ft.Divider(),
                ft.Text("Fallback Chain", weight=ft.FontWeight.BOLD),
                ft.Container(
                    content=self.fallback_list_view,
                    border=ft.border.all(1, ft.colors.OUTLINE_VARIANT),
                    border_radius=ft.border_radius.all(5),
                    padding=10,
                    height=150,
                ),
                self.add_fallback_button,
            ],
            spacing=15,
            tight=True,
            width=600,
            height=550,
        )
        self.actions = [
            ft.TextButton("Cancel", on_click=self.close_dialog),
            ft.ElevatedButton("Save", on_click=self.save_config),
        ]
        self.actions_alignment = ft.MainAxisAlignment.END

        if self.config_to_edit:
            self._populate_fields()
        logging.info("--- Dialog: __init__() COMPLETED ---")

    def _populate_fields(self):
        """Fills the dialog's controls with data from an existing config"""
        self.config_name_field.value = self.config_to_edit.get("name", "")
        self.primary_llm_dropdown.value = self.config_to_edit.get("primary_llm", "")
        self.prompt_field.value = self.config_to_edit.get("prompt", "")

        fallback_chain = self.config_to_edit.get("fallback_chain", [])
        for item in fallback_chain:
            row = FallbackItemRow(on_delete=self.delete_fallback_clicked)
            row.llm_dropdown.value = item.get("llm")
            row.prompt_field.value = item.get("prompt")

            self.fallback_list_view.controls.append(row)

    def add_fallback_clicked(self, e):
        """Adds a new empty FallBackItemRow row to the ListView"""
        new_row = FallbackItemRow(on_delete=self.delete_fallback_clicked)
        self.fallback_list_view.controls.append(new_row)
        self.page.update()

    def delete_fallback_clicked(self, row_to_delete: FallbackItemRow):
        """Removes a specific row from the ListView"""
        self.fallback_list_view.controls.remove(row_to_delete)
        self.page.update()

    def save_config(self, e):
        if not self.config_name_field.value:
            self.config_name_field.error_text = "Name cannot be empty"
            self.config_name_field.update()
            return

        fallback_chain_data = []
        for row in self.fallback_list_view.controls:
            fallback_chain_data.append(
                {"llm": row.llm_dropdown.value, "prompt": row.prompt_field.value}
            )

        config_data = {
            "name": self.config_name_field.value,
            "prompt": self.prompt_field.value,
            "primary_llm": self.primary_llm_dropdown.value,
            "fallback_chain": fallback_chain_data,
        }

        if self.original_config_name:
            self.config_manager.update_config(self.original_config_name, config_data)
        else:
            self.config_manager.add_config(config_data)

        if self.on_save_callback:
            self.on_save_callback()
        self.close_dialog(e)

    def close_dialog(self, e):
        self.page.close(self)
