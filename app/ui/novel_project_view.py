import flet as ft


class NovelProjectViewControls:
    def __init__(self):
        self.select_epub_button = None
        self.selected_epub_path_text = None
        self.epub_title_text = None
        self.epub_author_text = None
        self.chapter_count_text = None
        self.chapter_list_view = None
        self.primary_llm_dropdown = None
        self.main_prompt_field = None
        self.translate_novel_button = None
        self.translation_progress_bar = None
        self.output_log_field = None


def create_novel_project_view_content():
    controls = NovelProjectViewControls()

    controls.select_epub_button = ft.ElevatedButton(text="Select EPUB File")
    controls.selected_epub_path_text = ft.Text("No file selected.", italic=True)

    controls.epub_title_text = ft.Text("N/A")
    controls.epub_author_text = ft.Text("N/A")
    controls.chapter_count_text = ft.Text("0")

    controls.output_log_field = ft.TextField(
        label="Novel Processing Log / Output",
        multiline=True,
        read_only=True,
        min_lines=8,
    )

    epub_info_card = ft.Card(
        content=ft.Container(
            content=ft.Column(
                [
                    ft.Text("Novel Information", weight=ft.FontWeight.BOLD, size=16),
                    ft.Row(
                        [
                            ft.Text("Title:", weight=ft.FontWeight.BOLD),
                            controls.epub_title_text,
                        ]
                    ),
                    ft.Row(
                        [
                            ft.Text("Author:", weight=ft.FontWeight.BOLD),
                            controls.epub_author_text,
                        ]
                    ),
                    ft.Row(
                        [
                            ft.Text("Chapters:", weight=ft.FontWeight.BOLD),
                            controls.chapter_count_text,
                        ]
                    ),
                ],
                spacing=5,
            ),
            padding=10,
            width=400,
        )
    )

    file_select_column = ft.Column(
        [
            controls.select_epub_button,
            controls.selected_epub_path_text,
            ft.Divider(height=10),
            epub_info_card,
        ],
        spacing=10,
    )

    controls.chapter_list_view = ft.ListView(
        height=200,
        spacing=5,
    )

    chapter_list_container = ft.Container(
        content=ft.Column(
            [
                ft.Text("Chapters", weight=ft.FontWeight.BOLD, size=16),
                controls.chapter_list_view,
            ]
        ),
        padding=ft.padding.only(top=10, bottom=10),
        border=ft.border.all(1, ft.Colors.OUTLINE),
        border_radius=ft.border_radius.all(5),
    )

    controls.primary_llm_dropdown = ft.Dropdown(
        label="Primary LLM for Full Translation",
        width=400,
        options=[
            ft.dropdown.Option("gpt-4o (OpenAI)"),
            ft.dropdown.Option("gemini-1.5-pro (Google)"),
        ],
        hint_text="Select main LLM",
    )

    controls.main_prompt_field = ft.TextField(
        label="Main Translation Prompt",
        multiline=True,
        min_lines=3,
        max_lines=5,
        hint_text="Enter the primary prompt for translating the entire novel...",
    )

    llm_config_column = ft.Column(
        [
            ft.Text(
                "Full Novel Translation Settings", weight=ft.FontWeight.BOLD, size=16
            ),
            controls.primary_llm_dropdown,
            controls.main_prompt_field,
        ],
        spacing=10,
    )

    controls.translate_novel_button = ft.ElevatedButton(text="Translate Full Novel")
    controls.translation_progress_bar = ft.ProgressBar(
        value=0, width=400, visible=False
    )

    action_progress_column = ft.Column(
        [controls.translate_novel_button, controls.translation_progress_bar],
        spacing=10,
        horizontal_alignment=ft.CrossAxisAlignment.CENTER,
    )

    novel_project_page_content = ft.Column(
        [
            file_select_column,
            ft.Divider(height=20),
            chapter_list_container,
            ft.Divider(height=20),
            llm_config_column,
            ft.Divider(height=20),
            action_progress_column,
            ft.Divider(height=10),
            controls.output_log_field,
        ],
        spacing=15,
        scroll=ft.ScrollMode.ADAPTIVE,
        expand=True,
    )

    return ft.Container(
        content=novel_project_page_content,
        padding=ft.padding.all(20),
        alignment=ft.alignment.top_left,
        expand=True,
    ), controls
