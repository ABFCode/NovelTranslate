# File: app/ui/fallback_item_row.py

import flet as ft


class FallbackItemRow(ft.Row):
    def __init__(self, on_delete):
        super().__init__()

        self.vertical_alignment = ft.CrossAxisAlignment.CENTER
        self.spacing = 10

        self.on_delete = on_delete
        self.llm_dropdown = ft.Dropdown(
            label="Fallback LLM",
            options=[
                ft.dropdown.Option("gpt-4o"),
                ft.dropdown.Option("gemini-2.5-pro"),
                ft.dropdown.Option("claude-4-sonnet"),
            ],
            width=180,
            dense=True,
        )

        self.prompt_field = ft.TextField(
            label="Model-Specific Prompt for this Fallback",
            expand=True,
            dense=True,
        )

        self.delete_button = ft.IconButton(
            icon=ft.icons.DELETE_OUTLINE,
            icon_color=ft.colors.ERROR,
            tooltip="Remove this fallback step",
            on_click=self.delete_clicked,
        )

        self.controls = [
            self.llm_dropdown,
            self.prompt_field,
            self.delete_button,
        ]

    def delete_clicked(self, e):
        """
        This method is called when the user clicks the delete icon.
        It then calls the on_delete function that was passed in during
        initialization, telling the parent that this specific instance
        of the row should be deleted.
        """
        self.on_delete(self)
