import flet as ft


class SettingsViewControls:
    def __init(self):
        self.openai_key_field = None
        self.gemini_key_field = None
        self.grok_key_field = None
        self.claude_key_field = None
        self.save_keys_button = None


def create_settings_view_content():
    controls = SettingsViewControls()

    controls.openai_key_field = ft.TextField(
        label="OpenAI API Key",
        width=400,
        data="openai_api_key",
    )

    controls.gemini_key_field = ft.TextField(
        label="Gemini API Key",
        width=400,
        data="gemini_api_key",
    )

    controls.grok_key_field = ft.TextField(
        label="Grok API Key",
        width=400,
        data="grok_api_key",
    )

    controls.claude_key_field = ft.TextField(
        label="Claude API Key",
        width=400,
        data="claude_api_key",
    )

    controls.save_keys_button = ft.ElevatedButton(text="Save API Keys")

    api_keys_column = ft.Column(
        controls=[
            ft.Text("API Key Management", size=18, weight=ft.FontWeight.BOLD),
            controls.claude_key_field,
            controls.gemini_key_field,
            controls.grok_key_field,
            controls.openai_key_field,
            ft.Container(height=10),
            controls.save_keys_button,
        ],
        spacing=15,
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
