import flet as ft

class MainViewControls:
    def __init__(self):
        self.select_epub_button = None
        self.selected_epub_path = None
        self.output_log_field = None
        self.openai_key_field = None
        self.gemini_key_field = None
        self.llm_dropdown = None
        self.prompt_input_field = None
        self.test_chapter_button = None
        self.translate_novel_button = None


def create_main_view():
    controls = MainViewControls()

    controls.select_epub_button = ft.ElevatedButton("Select EPUB File")
    controls.selected_epub_path = ft.Text("No file selected")

    file_selection_row = ft.Row(
        controls=[controls.select_epub_button, controls.selected_epub_path],
        alignment=ft.MainAxisAlignment.START,
    )

    controls.openai_key_field = ft.TextField( 
        label="OpenAI API Key",
        password=True,
        can_reveal_password=True,
        width=400
    )
    controls.gemini_key_field = ft.TextField( 
        label="Gemini API Key",
        password=True,
        can_reveal_password=True,
        width=400
    )
    api_keys_column = ft.Column(
        controls=[
            ft.Text("API Keys:", weight=ft.FontWeight.BOLD),
            controls.openai_key_field,
            controls.gemini_key_field,
        ]
    )

    controls.llm_dropdown = ft.Dropdown( 
        label="Select LLM for Testing/Translation",
        width=400,
        options=[
            ft.dropdown.Option("gpt-4o (OpenAI)"),
            ft.dropdown.Option("gemini-1.5-pro (Google)"),
            ft.dropdown.Option("claude-3-opus (Anthropic)"),
            ft.dropdown.Option("grok-1 (Grok)"),
        ],
    )

    controls.prompt_input_field = ft.TextField( 
        label="Translation Prompt",
        multiline=True,
        min_lines=3,
        max_lines=10,
        hint_text="e.g., Translate the following chapter into fluent English...",
    )

    controls.test_chapter_button = ft.ElevatedButton("Test Chapter") # Store ref
    controls.translate_novel_button = ft.ElevatedButton("Translate Full Novel") # Store ref

    action_buttons_row = ft.Row(
        controls=[controls.test_chapter_button, controls.translate_novel_button],
        spacing=20
    )

    controls.output_log_field = ft.TextField( 
        label="Output / Log",
        multiline=True,
        read_only=True,
        min_lines=10,
    )

    main_column = ft.Column(
        controls=[
            file_selection_row,
            ft.Divider(),
            api_keys_column,
            ft.Divider(),
            controls.llm_dropdown,
            controls.prompt_input_field,
            ft.Divider(),
            action_buttons_row,
            ft.Divider(),
            controls.output_log_field,
        ],
        spacing=15,
        scroll=ft.ScrollMode.ADAPTIVE,
        expand=True,
    )

    return main_column, controls

