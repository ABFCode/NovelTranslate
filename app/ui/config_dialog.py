import logging

import flet as ft


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

        if self.config_to_edit:
            self.title = ft.Text("Edit Configuration")
        else:
            self.title = ft.Text("Create new Configuration")

        self.config_name_field = ft.TextField(
            label="Configuration Name",
            autofocus=True,
            value=self.config_to_edit.get("name") if self.config_to_edit else "",
        )
        self.prompt_field = ft.TextField(
            label="System Prompt",
            multiline=True,
            min_lines=3,
            value=self.config_to_edit.get("prompt") if self.config_to_edit else "",
        )
        self.primary_llm_dropdown = ft.Dropdown(
            label="Primary LLM",
            options=[
                ft.dropdown.Option("gpt-4o"),
                ft.dropdown.Option("gemini-2.5-pro"),
                ft.dropdown.Option("claude-4-sonnet"),
            ],
            value=self.config_to_edit.get("primary_llm") if self.config_to_edit else "",
        )
        self.fallback_chain_ui = ft.Text("Fallback chain UI will go here", italic=True)
        self.content = ft.Column(
            [
                self.config_name_field,
                self.prompt_field,
                self.primary_llm_dropdown,
                self.fallback_chain_ui,
            ],
            spacing=15,
            tight=True,
        )
        self.actions = [
            ft.TextButton("Cancel", on_click=self.close_dialog),
            ft.ElevatedButton("Save", on_click=self.save_config),
        ]
        self.actions_alignment = ft.MainAxisAlignment.END
        logging.info("--- Dialog: __init__() COMPLETED ---")

    def close_dialog(self, e):
        self.open = False
        self.page.update()

    def save_config(self, e):
        config_data = {
            "name": self.config_name_field.value,
            "prompt": self.prompt_field.value,
            "primary_llm": self.primary_llm_dropdown.value,
            "fallback_chain": [],
        }

        if not config_data["name"]:
            self.config_name_field.error_text = "Name cannot be empty"
            self.config_name_field.update()
            return

        if self.original_config_name:
            self.config_manager.update_config(self.original_config_name, config_data)
        else:
            self.config_manager.add_config(config_data)

        if self.on_save_callback:
            self.on_save_callback()
        self.close_dialog(e)
