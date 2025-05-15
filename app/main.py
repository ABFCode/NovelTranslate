import logging
import flet as ft
from flet import FilePickerResultEvent
from app.core.epub_parser import parse_epub
from app.ui.novel_project_view import (
    create_novel_project_view_content,
    create_chapter_item,
)
from app.ui.settings_view import create_settings_view_content

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)

current_view_controls = None
parsed_chapters_data = {
    "title": "N/A",
    "author": "N/A",
    "chapters_meta": [],
}
# Each dictionary in chapters_meta will look like:
# {
# "number": int,
# "title_source": str, # Raw material for the title, e.g., first 70 chars
# "original_text": str,
# "translated_text": str or None,
# "status": str # e.g., "pending", "in_progress", "completed", "error"
# }


def create_testing_lab_view():
    return ft.Column(
        [ft.Text("Advanced Testing Lab View Content", size=20)],
        alignment=ft.MainAxisAlignment.CENTER,
        horizontal_alignment=ft.CrossAxisAlignment.CENTER,
        expand=True,
    )


def handle_file_picker_result(e: FilePickerResultEvent, page: ft.Page):
    global current_view_controls
    global parsed_chapters_data
    current_view_controls.selected_epub_path_text.value = "Processing..."
    current_view_controls.output_log_field.value = ""
    current_view_controls.epub_title_text.value = "N/A"
    current_view_controls.epub_author_text.value = "N/A"
    current_view_controls.chapter_count_text.value = "0"
    parsed_chapters_data = {
        "title": "N/A",
        "author": "N/A",
        "chapters_meta": [],
    }
    if current_view_controls.chapter_list_view:
        current_view_controls.chapter_list_view.controls.clear()
    page.update()

    if e.files:
        selected_file_path = e.files[0].path
        current_view_controls.selected_epub_path_text.value = (
            f"Selected: {selected_file_path}"
        )
        logging.info(f"File Selected: {selected_file_path}")
        success, result = parse_epub(selected_file_path)

        if success:
            raw_chapter_texts = result
            for i, chap_text in enumerate(raw_chapter_texts):
                snippet = chap_text[:70].replace("\n", " ").strip()
                parsed_chapters_data["chapters_meta"].append(
                    {
                        "number": i + 1,
                        "title_source": snippet,
                        "original_text": chap_text,
                        "translated_text": None,
                        "status": "pending",
                    }
                )

            try:
                from ebooklib import epub

                book = epub.read_epub(selected_file_path)
                title_meta = book.get_metadata("DC", "title")
                author_meta = book.get_metadata("DC", "creator")
                if title_meta:
                    parsed_chapters_data["title"] = title_meta[0][0]
                if author_meta:
                    parsed_chapters_data["author"] = author_meta[0][0]
            except Exception as meta_ex:
                logging.warning(f"Could not extract metadata: {meta_ex}")

            current_view_controls.epub_title_text.value = parsed_chapters_data["title"]
            current_view_controls.epub_author_text.value = parsed_chapters_data[
                "author"
            ]
            current_view_controls.chapter_count_text.value = str(
                len(parsed_chapters_data["chapters_meta"])
            )

            log_message = f"Successfully parsed EPUB: {parsed_chapters_data['title']}.\nFound {len(parsed_chapters_data['chapters_meta'])} chapters.\n"
            if parsed_chapters_data["chapters_meta"]:
                log_message += f"\nFirst chapter preview:\n---\n{parsed_chapters_data['chapters_meta'][0]['original_text'][:200]}..."
                if current_view_controls.chapter_list_view:
                    current_view_controls.chapter_list_view.controls.clear()
                    for chap_meta in parsed_chapters_data["chapters_meta"]:
                        current_view_controls.chapter_list_view.controls.append(
                            create_chapter_item(
                                chapter_number=chap_meta["number"],
                                chapter_title=chap_meta["title_source"],
                                status=chap_meta["status"],
                            )
                        )
                current_view_controls.output_log_field.value = log_message
                logging.info(
                    f"EPUB parsed successfully, {len(parsed_chapters_data['chapters_meta'])} chapters found."
                )
            else:
                current_view_controls.output_log_field.value = (
                    "Successfully parsed EPUB, but no chapter content found."
                )
                logging.warning("EPUB parsed but no chapter content extracted.")

        else:  # Parsing failed
            error_message = (
                result if isinstance(result, str) else "Unknown parsing error."
            )
            current_view_controls.selected_epub_path_text.value = (
                "Error parsing file (see log)"
            )
            current_view_controls.output_log_field.value = f"Error: {error_message}"
            logging.error(f"EPUB parsing failed: {error_message}")
    else:
        current_view_controls.selected_epub_path_text.value = (
            "File selection cancelled."
        )
        logging.info("File selection cancelled by user.")
    page.update()


def main(page: ft.Page):
    page.title = "NovelTranslate"
    page.vertical_alignment = ft.MainAxisAlignment.START
    page.horizontal_alignment = ft.CrossAxisAlignment.START
    page.window.width = 1000
    page.window.height = 800
    page.window_resizable = False

    file_picker = ft.FilePicker(on_result=lambda e: handle_file_picker_result(e, page))
    page.overlay.append(file_picker)
    main_content_area = ft.Column(expand=True)

    def navigation_changed(e):
        global current_view_controls
        global parsed_chapters_data
        selected_index = e.control.selected_index
        main_content_area.controls.clear()
        current_view_controls = None

        if selected_index == 0:
            novel_view_content, novel_controls = create_novel_project_view_content()
            main_content_area.controls.append(novel_view_content)
            current_view_controls = novel_controls

            if (
                hasattr(novel_controls, "select_epub_button")
                and novel_controls.select_epub_button
            ):
                current_view_controls.select_epub_button.on_click = (
                    lambda _: file_picker.pick_files(
                        allow_multiple=False, allowed_extensions=["epub"]
                    )
                )

            if parsed_chapters_data["chapters_meta"]:
                novel_controls.selected_epub_path_text.value = (
                    "Previously loaded EPUB (re-select if needed)"
                )
                novel_controls.epub_title_text.value = parsed_chapters_data["title"]
                novel_controls.epub_author_text.value = parsed_chapters_data["author"]
                novel_controls.chapter_count_text.value = str(
                    len(parsed_chapters_data["chapters_meta"])
                )
                if novel_controls.chapter_list_view:
                    novel_controls.chapter_list_view.controls.clear()
                    for chap_meta in parsed_chapters_data["chapters_meta"]:
                        novel_controls.chapter_list_view.controls.append(
                            create_chapter_item(  # <--- USE THE HELPER
                                chapter_number=chap_meta["number"],
                                chapter_title=chap_meta["title_source"],
                                status=chap_meta["status"],
                            )
                        )
            else:
                novel_controls.selected_epub_path_text.value = "No file selected."
                novel_controls.epub_title_text.value = "N/A"
                novel_controls.epub_author_text.value = "N/A"
                novel_controls.chapter_count_text.value = "0"
                if novel_controls.chapter_list_view:
                    novel_controls.chapter_list_view.controls.clear()  # Also clear if no chapters

        elif selected_index == 1:  # Testing View
            testing_content = create_testing_lab_view()
            main_content_area.controls.append(testing_content)
        elif selected_index == 2:  # Settings View
            settings_content, settings_controls = create_settings_view_content()
            main_content_area.controls.append(settings_content)
            current_view_controls = settings_controls
        page.update()

    rail = ft.NavigationRail(
        selected_index=0,
        label_type=ft.NavigationRailLabelType.ALL,
        min_width=100,
        min_extended_width=200,
        group_alignment=-1.0,
        destinations=[
            ft.NavigationRailDestination(
                icon=ft.Icons.BOOK_OUTLINED,
                selected_icon=ft.Icons.BOOK,
                label_content=ft.Text("Novel"),
            ),
            ft.NavigationRailDestination(
                icon=ft.Icons.SCIENCE_OUTLINED,
                selected_icon=ft.Icons.SCIENCE,
                label_content=ft.Text("Testing"),
            ),
            ft.NavigationRailDestination(
                icon=ft.Icons.SETTINGS_OUTLINED,
                selected_icon=ft.Icons.SETTINGS,
                label_content=ft.Text("Settings"),
            ),
        ],
        on_change=navigation_changed,
    )

    page_layout = ft.Row(
        [rail, ft.VerticalDivider(width=1), main_content_area],
        expand=True,
    )
    page.add(page_layout)

    initial_event_data = str(rail.selected_index)
    navigation_changed(
        ft.ControlEvent(
            target=rail.uid,
            name="change",
            data=initial_event_data,
            control=rail,
            page=page,
        )
    )


if __name__ == "__main__":
    ft.app(target=main)
