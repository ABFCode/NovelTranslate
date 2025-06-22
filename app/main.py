import logging

import flet as ft
from flet import FilePickerResultEvent

from app.core.app_state import AppState
from app.core.config_manager import ConfigManager
from app.core.epub_parser import parse_epub
from app.ui.config_dialog import ConfigDialog
from app.ui.manage_configs_dialog import ManageConfigsDialog
from app.ui.novel_project_view import (
    NovelProjectViewControls,
    create_chapter_item,
    create_novel_project_view_content,
)
from app.ui.settings_view import create_settings_view_content

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)

config_manager = ConfigManager()
app_state = AppState()


current_view_controls = None
app_state.active_config_name = None


def create_testing_lab_view():
    return ft.Column(
        [ft.Text("Advanced Testing Lab View Content", size=20)],
        alignment=ft.MainAxisAlignment.CENTER,
        horizontal_alignment=ft.CrossAxisAlignment.CENTER,
        expand=True,
    )


def handle_file_picker_result(e: FilePickerResultEvent, page: ft.Page):
    global current_view_controls
    current_view_controls.selected_epub_path_text.value = "Processing..."
    current_view_controls.output_log_field.value = ""
    current_view_controls.epub_title_text.value = "N/A"
    current_view_controls.epub_author_text.value = "N/A"
    current_view_controls.chapter_count_text.value = "0"
    app_state.reset_epub_data()
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
                app_state.epub_data["chapters_meta"].append(
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
                    app_state.epub_data["title"] = title_meta[0][0]
                if author_meta:
                    app_state.epub_data["author"] = author_meta[0][0]
            except Exception as meta_ex:
                logging.warning(f"Could not extract metadata: {meta_ex}")

            current_view_controls.epub_title_text.value = app_state.epub_data["title"]
            current_view_controls.epub_author_text.value = app_state.epub_data["author"]
            current_view_controls.chapter_count_text.value = str(
                len(app_state.epub_data["chapters_meta"])
            )

            log_message = f"Successfully parsed EPUB: {app_state.epub_data['title']}.\nFound {len(app_state.epub_data['chapters_meta'])} chapters.\n"
            if app_state.epub_data["chapters_meta"]:
                log_message += f"\nFirst chapter preview:\n---\n{app_state.epub_data['chapters_meta'][0]['original_text'][:200]}..."
                if current_view_controls.chapter_list_view:
                    current_view_controls.chapter_list_view.controls.clear()
                    for chap_meta in app_state.epub_data["chapters_meta"]:
                        current_view_controls.chapter_list_view.controls.append(
                            create_chapter_item(
                                chapter_number=chap_meta["number"],
                                chapter_title=chap_meta["title_source"],
                                status=chap_meta["status"],
                            )
                        )
                current_view_controls.output_log_field.value = log_message
                logging.info(
                    f"EPUB parsed successfully, {len(app_state.epub_data['chapters_meta'])} chapters found."
                )
            else:
                current_view_controls.output_log_field.value = (
                    "Successfully parsed EPUB, but no chapter content found."
                )
                logging.warning("EPUB parsed but no chapter content extracted.")

        else:
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

    def on_config_saved_or_deleted():
        """Callback function to refresh UI eleemnts that depend on config"""
        logging.info("Configuration saved. Refreshing UI elements")
        update_active_config_dropdown()

    def open_create_config_dialog(e):
        logging.info("Main: open_manage_config_dialog() CALLED")
        create_dialog = ConfigDialog(
            config_manager, on_save_callback=on_config_saved_or_deleted
        )
        logging.info("--- Main: ConfigDialog instance created successfully. ---")
        page.dialog = create_dialog
        if create_dialog not in page.overlay:
            page.overlay.append(create_dialog)
        create_dialog.open = True
        page.update()
        logging.info("--- Main: Dialog opened and page updated. ---")

    def open_edit_config_dialog(config_name: str):
        config_to_edit = config_manager.get_config(config_name)
        if not config_to_edit:
            logging.error(f"Could not find config '{config_name} to edit")
            return

        edit_dialog = ConfigDialog(
            config_manager,
            on_save_callback=on_config_saved_or_deleted,
            config_to_edit=config_to_edit,
        )
        page.dialog = edit_dialog
        if edit_dialog not in page.overlay:
            page.overlay.append(edit_dialog)
        edit_dialog.open = True
        page.update()

    def open_manage_configs_dialog(e):
        """Opens the main dialog for managing all config"""
        manage_dialog = ManageConfigsDialog(
            config_manager,
            on_close_callback=on_config_saved_or_deleted,
            on_add_new_callback=open_create_config_dialog,
            on_edit_callback=open_edit_config_dialog,
        )
        page.dialog = manage_dialog
        if manage_dialog not in page.overlay:
            page.overlay.append(manage_dialog)
        page.dialog = manage_dialog
        manage_dialog.open = True
        page.update()

    def update_active_config_dropdown():
        if (
            isinstance(current_view_controls, NovelProjectViewControls)
            and hasattr(current_view_controls, "active_config_dropdown")
            and current_view_controls.active_config_dropdown
        ):
            dropdown = current_view_controls.active_config_dropdown
            current_value = dropdown.value
            all_configs = config_manager.get_all_configs()

            dropdown.options = [ft.dropdown.Option(name) for name in all_configs.keys()]

            new_options = [opt.key for opt in dropdown.options]
            if current_value in new_options:
                dropdown.value = current_value
            else:
                dropdown.value = app_state.active_config_name

    def on_active_config_change(e):
        app_state.active_config_name = e.control.value
        logging.info(
            f"Active configuraiton cahnged to : {app_state.active_config_name}"
        )

    def navigation_changed(e):
        global current_view_controls
        selected_index = e.control.selected_index
        main_content_area.controls.clear()
        current_view_controls = None

        if selected_index == 0:
            novel_view_content, novel_controls = create_novel_project_view_content()
            main_content_area.controls.append(novel_view_content)
            current_view_controls = novel_controls
            update_active_config_dropdown()

            if (
                hasattr(novel_controls, "select_epub_button")
                and novel_controls.select_epub_button
            ):
                current_view_controls.select_epub_button.on_click = (
                    lambda _: file_picker.pick_files(
                        allow_multiple=False, allowed_extensions=["epub"]
                    )
                )

            if hasattr(novel_controls, "manage_configs_button"):
                novel_controls.manage_configs_button.on_click = (
                    open_manage_configs_dialog
                )

            if hasattr(novel_controls, "active_config_dropdown"):
                novel_controls.active_config_dropdown.on_change = (
                    on_active_config_change
                )

            if app_state.epub_data["chapters_meta"]:
                novel_controls.selected_epub_path_text.value = (
                    "Previously loaded EPUB (re-select if needed)"
                )
                novel_controls.epub_title_text.value = app_state.epub_data["title"]
                novel_controls.epub_author_text.value = app_state.epub_data["author"]
                novel_controls.chapter_count_text.value = str(
                    len(app_state.epub_data["chapters_meta"])
                )
                if novel_controls.chapter_list_view:
                    novel_controls.chapter_list_view.controls.clear()
                    for chap_meta in app_state.epub_data["chapters_meta"]:
                        novel_controls.chapter_list_view.controls.append(
                            create_chapter_item(
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
                    novel_controls.chapter_list_view.controls.clear()

        elif selected_index == 1:
            testing_content = create_testing_lab_view()
            main_content_area.controls.append(testing_content)
        elif selected_index == 2:
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
