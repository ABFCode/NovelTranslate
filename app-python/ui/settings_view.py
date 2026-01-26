import flet as ft


class SettingsViewControls:
    def __init__(self):
        self.key_control_sets = {}


def _create_api_key_entry(key_name: str, display_name: str, controller):
    """
    Creates a set of controls for a single API key entry, including display and edit modes.
    """

    display_text = ft.Text(f"{display_name} Key: Not set", italic=True)
    edit_button = ft.IconButton(
        icon=ft.Icons.EDIT_ROUNDED,
        tooltip=f"Edit {display_name} Key",
        on_click=lambda e: controller.show_edit_mode(e, key_name),
    )

    delete_button = ft.IconButton(
        icon=ft.Icons.DELETE_FOREVER_ROUNDED,
        icon_color=ft.colors.ERROR,
        tooltip=f"Delete {display_name} key",
        on_click=lambda e: controller.delete_key(e, key_name),
    )

    display_row = ft.Row(
        controls=[display_text, edit_button, delete_button],
        vertical_alignment=ft.CrossAxisAlignment.CENTER,
    )

    edit_field = ft.TextField(
        label=f"Enter new {display_name} Key",
        password=True,
        can_reveal_password=True,
        expand=True,
    )

    save_button = ft.ElevatedButton(
        "Save",
        icon=ft.Icons.SAVE_ROUNDED,
        on_click=lambda e: controller.save_key(e, key_name),
    )

    cancel_button = ft.TextButton(
        "Cancel", on_click=lambda e: controller.cancel_edit_mode(e, key_name)
    )

    edit_row = ft.Row(controls=[edit_field, save_button, cancel_button], visible=False)

    return {
        "display_text": display_text,
        "delete_button": delete_button,
        "display_row": display_row,
        "edit_field": edit_field,
        "edit_row": edit_row,
        "container": ft.Column([display_row, edit_row]),
    }


def create_settings_view_content(controller):
    """
    Creates the content for the entire Settings view.
    """
    controls = SettingsViewControls()
    api_key_rows = []
    key_definitions = {"openai_api_key": "OpenAI", "gemini_api_key": "Gemini"}

    for key_name, display_name in key_definitions.items():
        key_controls = _create_api_key_entry(key_name, display_name, controller)
        controls.key_control_sets[key_name] = key_controls
        api_key_rows.append(key_controls["container"])

    api_keys_column = ft.Column(
        controls=[
            ft.Text("API Key Management", size=18, weight=ft.FontWeight.BOLD),
            *api_key_rows,
        ],
        spacing=15,
        width=600,
    )

    settings_page_content = ft.Column(
        [
            ft.Container(
                api_keys_column,
                padding=ft.padding.all(20),
                alignment=ft.alignment.top_left,
            )
        ],
        expand=True,
        alignment=ft.MainAxisAlignment.START,
        horizontal_alignment=ft.CrossAxisAlignment.START,
    )
    return settings_page_content, controls
