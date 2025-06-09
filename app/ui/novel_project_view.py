import flet as ft


class NovelProjectViewControls:
    def __init__(self):
        self.select_epub_button = None
        self.selected_epub_path_text = None
        self.epub_title_text = None
        self.epub_author_text = None
        self.chapter_count_text = None

        self.translation_status_text = None
        self.overall_progress_bar = None
        self.active_config_dropdown = None
        self.manage_configs_button = None

        self.chapter_list_view = None

        self.start_translation_button = None
        self.pause_translation_button = None
        self.cancel_translation_button = None
        self.export_novel_button = None
        self.output_log_field = None


def create_chapter_item(
    chapter_number: int, chapter_title: str, status: str = "pending"
):
    """Helper function to create a UI item for a single chapter."""
    status_Icons = {
        "pending": ft.Icons.HOURGLASS_EMPTY_ROUNDED,
        "in_progress": ft.Icons.SYNC_ROUNDED,
        "completed": ft.Icons.CHECK_CIRCLE_ROUNDED,
        "error": ft.Icons.ERROR_ROUNDED,
    }
    status_colors = {
        "pending": ft.colors.ON_SURFACE_VARIANT,
        "in_progress": ft.colors.BLUE_ACCENT,
        "completed": ft.colors.GREEN_ACCENT_700,
        "error": ft.colors.RED_ACCENT_700,
    }

    icon = ft.Icon(
        name=status_Icons.get(status, ft.Icons.HELP_OUTLINE),
        color=status_colors.get(status, ft.colors.ON_SURFACE_VARIANT),
        size=20,
    )

    display_title = (
        (chapter_title[:40] + "...") if len(chapter_title) > 43 else chapter_title
    )

    return ft.Container(
        content=ft.Row(
            [
                icon,
                ft.Text(
                    f"Ch {chapter_number}: {display_title}",
                    overflow=ft.TextOverflow.ELLIPSIS,
                    expand=True,
                ),
            ],
            spacing=10,
            vertical_alignment=ft.CrossAxisAlignment.CENTER,
        ),
        padding=ft.padding.symmetric(horizontal=10, vertical=8),
        border_radius=ft.border_radius.all(4),
    )


def create_novel_project_view_content():
    controls = NovelProjectViewControls()
    common_border_radius = ft.border_radius.all(8)
    common_border = ft.border.all(1, ft.colors.OUTLINE_VARIANT)
    common_padding = 15

    controls.select_epub_button = ft.ElevatedButton(text="Select EPUB File")
    controls.selected_epub_path_text = ft.Text(
        "No file selected.", italic=True, size=12
    )
    controls.epub_title_text = ft.Text("N/A")
    controls.epub_author_text = ft.Text("N/A")
    controls.chapter_count_text = ft.Text("0")

    epub_info_content = ft.Column(
        [
            ft.Text("Novel Information", weight=ft.FontWeight.BOLD, size=16),
            controls.select_epub_button,
            controls.selected_epub_path_text,
            ft.Row(
                [ft.Text("Title:", weight=ft.FontWeight.BOLD), controls.epub_title_text]
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
        spacing=8,
        alignment=ft.MainAxisAlignment.START,
    )
    epub_info_container = ft.Container(
        content=epub_info_content,
        padding=common_padding,
        border_radius=common_border_radius,
        border=common_border,
        expand=1,
    )

    controls.translation_status_text = ft.Text(
        "Status: Idle", weight=ft.FontWeight.BOLD
    )
    controls.overall_progress_bar = ft.ProgressBar(value=0, width=250, bar_height=10)
    controls.active_config_dropdown = ft.Dropdown(
        label="Active Configuration", options=[]
    )
    controls.manage_configs_button = ft.OutlinedButton(text="Manage Configurations")

    translation_status_content = ft.Column(
        [
            ft.Text("Translation Overview", weight=ft.FontWeight.BOLD, size=16),
            controls.translation_status_text,
            ft.Text("Overall Progress:"),
            controls.overall_progress_bar,
            ft.Row(
                [
                    ft.Text("Using:", width=50),
                    ft.Container(content=controls.active_config_dropdown, expand=True),
                ],
                vertical_alignment=ft.CrossAxisAlignment.CENTER,
            ),
            controls.manage_configs_button,
        ],
        spacing=8,
        alignment=ft.MainAxisAlignment.START,
    )
    translation_status_container = ft.Container(
        content=translation_status_content,
        padding=common_padding,
        border_radius=common_border_radius,
        border=common_border,
        expand=1,
    )

    top_row = ft.Row(
        [epub_info_container, translation_status_container],
        spacing=20,
        vertical_alignment=ft.CrossAxisAlignment.START,
    )

    controls.chapter_list_view = ft.ListView(
        spacing=5,
        padding=ft.padding.symmetric(vertical=5),
        expand=True,
    )

    chapter_progress_section = ft.Column(
        [
            ft.Text("Chapter Status", weight=ft.FontWeight.BOLD, size=16),
            ft.Container(
                content=controls.chapter_list_view,
                border=ft.border.all(1, ft.colors.OUTLINE_VARIANT),
                border_radius=ft.border_radius.all(5),
                padding=ft.padding.all(5),
                expand=True,
            ),
        ],
        spacing=5,
        expand=True,
    )

    controls.start_translation_button = ft.ElevatedButton(
        text="Start Translation", icon=ft.Icons.PLAY_ARROW_ROUNDED
    )
    controls.pause_translation_button = ft.OutlinedButton(
        text="Pause", icon=ft.Icons.PAUSE_ROUNDED, disabled=True
    )
    controls.cancel_translation_button = ft.OutlinedButton(
        text="Cancel",
        icon=ft.Icons.CANCEL_OUTLINED,
        disabled=True,
        icon_color=ft.colors.ERROR,
    )
    controls.export_novel_button = ft.ElevatedButton(
        text="Assemble & Export Novel", icon=ft.Icons.ARCHIVE_OUTLINED, disabled=True
    )

    actions_content = ft.Column(
        [
            ft.Text("Actions", weight=ft.FontWeight.BOLD, size=16),
            controls.start_translation_button,
            ft.Row(
                [controls.pause_translation_button, controls.cancel_translation_button],
                spacing=10,
            ),
            controls.export_novel_button,
        ],
        spacing=10,
        alignment=ft.MainAxisAlignment.START,
    )
    actions_container = ft.Container(
        content=actions_content,
        padding=common_padding,
        border_radius=common_border_radius,
        border=common_border,
        width=280,
    )

    controls.output_log_field = ft.TextField(
        label="Processing Log",
        multiline=True,
        read_only=True,
        min_lines=5,
        border_radius=common_border_radius,
        expand=True,
    )
    output_log_container = ft.Container(
        content=controls.output_log_field,
        padding=common_padding,
        border_radius=common_border_radius,
        border=common_border,
        expand=True,
    )

    bottom_row = ft.Row(
        [actions_container, output_log_container],
        spacing=20,
        vertical_alignment=ft.CrossAxisAlignment.START,
    )

    novel_project_page_content = ft.Column(
        [
            ft.Container(content=top_row, expand=0),
            ft.Container(content=chapter_progress_section, expand=3),
            ft.Container(content=bottom_row, expand=2),
        ],
        spacing=15,
        expand=True,
    )

    return ft.Container(
        content=novel_project_page_content,
        padding=ft.padding.all(15),
        alignment=ft.alignment.top_left,
        expand=True,
    ), controls
