import logging

import flet as ft


class ConfigDialog(ft.AlertDialog):
    def __init__(self, config_manager, on_save_callback):
        super().__init__()
        logging.info("--- Dialog: __init__() STARTED ---")
        self.config_manager = config_manager
        self.on_save_callback = on_save_callback
        self.modal = True
        self.title = ft.Text("Create new Config")

        self.config_name_field = ft.TextField(
            label="Configuration Name", autofocus=True
        )
        self.prompt_field = ft.TextField(
            label="System Prompt", multiline=True, min_lines=3
        )
        self.primary_llm_dropdown = ft.Dropdown(
            label="Primary LLM",
            options=[
                ft.dropdown.Option("gpt-4o"),
                ft.dropdown.Option("gemini-2.5-pro"),
                ft.dropdown.Option("claude-4-sonnet"),
            ],
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

        self.config_manager.add_config(config_data)

        if self.on_save_callback:
            self.on_save_callback()
        self.close_dialog(e)
