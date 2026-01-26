import logging

import flet as ft

from app.controllers.main_controller import MainController
from app.core.app_state import AppState
from app.core.config_manager import ConfigManager
from app.ui.novel_project_view import (
    create_chapter_item,
    create_novel_project_view_content,
)
from app.ui.settings_view import create_settings_view_content
from app.ui.testing_lab_view import create_testing_lab_view

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)


def main(page: ft.Page):
    page.title = "NovelTranslate"

    page.theme = ft.Theme(color_scheme_seed=ft.Colors.BLUE_GREY)
    page.dark_theme = ft.Theme(color_scheme_seed=ft.Colors.BLUE_GREY)
    page.theme_mode = ft.ThemeMode.SYSTEM

    page.window.width = 1200
    page.window.height = 900

    config_manager = ConfigManager()
    app_state = AppState()
    controller = MainController(page, app_state, config_manager)

    file_picker = ft.FilePicker(on_result=controller.handle_file_picker_result)
    page.overlay.append(file_picker)

    def route_change(e):
        main_content_area.controls.clear()
        controller.set_view_controls(None)

        if e.route == "/":
            rail.selected_index = 0
            _setup_novel_view()

        elif e.route == "/testing":
            rail.selected_index = 1
            _setup_testing_view()

        elif e.route == "/settings":
            rail.selected_index = 2
            _setup_settings_view()

        page.update()

    def _setup_novel_view():
        """Set up the novel project view."""
        novel_view_content, novel_controls = create_novel_project_view_content()
        main_content_area.controls.append(novel_view_content)
        controller.set_view_controls(novel_controls)

        novel_controls.select_epub_button.on_click = lambda _: file_picker.pick_files(
            allow_multiple=False, allowed_extensions=["epub"]
        )
        novel_controls.manage_configs_button.on_click = (
            controller.open_manage_configs_dialog
        )
        novel_controls.active_config_dropdown.on_change = (
            controller.on_active_config_change
        )

        novel_controls.start_translation_button.on_click = controller.start_translation
        novel_controls.pause_translation_button.on_click = controller.pause_translation
        novel_controls.cancel_translation_button.on_click = (
            controller.cancel_translation
        )

        if hasattr(novel_controls, "open_project_button"):
            novel_controls.open_project_button.on_click = controller.open_project_folder
        if hasattr(novel_controls, "project_info_button"):
            novel_controls.project_info_button.on_click = controller.show_project_info

        controller.update_active_config_dropdown()
        _restore_epub_state(novel_controls)

    def _setup_testing_view():
        """Set up the testing lab view."""
        testing_content = create_testing_lab_view()
        main_content_area.controls.append(testing_content)

    def _setup_settings_view():
        """Set up the settings view."""
        settings_content, settings_controls = create_settings_view_content(controller)
        main_content_area.controls.append(settings_content)
        controller.set_view_controls(settings_controls)
        controller.load_api_keys()

    def _restore_epub_state(novel_controls):
        """Restore EPUB state if data is already loaded."""
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
        on_change=lambda e: page.go(
            ["/", "/testing", "/settings"][e.control.selected_index]
        ),
    )

    main_content_area = ft.Column(expand=True)

    page_layout = ft.Row(
        controls=[
            rail,
            ft.VerticalDivider(width=1),
            main_content_area,
        ],
        expand=True,
    )

    page.add(page_layout)
    page.on_route_change = route_change
    page.go(page.route)


if __name__ == "__main__":
    ft.app(target=main)
