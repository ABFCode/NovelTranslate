import logging

import flet as ft

from app.core.app_state import AppState
from app.core.config_manager import ConfigManager
from app.ui.main_controller import AppController
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

    page.theme = ft.Theme(color_scheme_seed=ft.colors.BLUE_GREY)
    page.dark_theme = ft.Theme(color_scheme_seed=ft.colors.BLUE_GREY)
    page.theme_mode = ft.ThemeMode.SYSTEM

    page.window.width = 1000
    page.window.height = 800
    page.window_resizable = False

    config_manager = ConfigManager()
    app_state = AppState()
    controller = AppController(page, app_state, config_manager)

    file_picker = ft.FilePicker(on_result=controller.handle_file_picker_result)
    page.overlay.append(file_picker)

    def route_change(e):
        main_content_area.controls.clear()
        controller.view_controls = None

        if e.route == "/":
            rail.selected_index = 0

            novel_view_content, novel_controls = create_novel_project_view_content()
            main_content_area.controls.append(novel_view_content)
            controller.view_controls = novel_controls

            novel_controls.select_epub_button.on_click = (
                lambda _: file_picker.pick_files(
                    allow_multiple=False, allowed_extensions=["epub"]
                )
            )
            novel_controls.manage_configs_button.on_click = (
                controller.open_manage_configs_dialog
            )
            novel_controls.active_config_dropdown.on_change = (
                controller.on_active_config_change
            )

            controller.update_active_config_dropdown()
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

        elif e.route == "/testing":
            rail.selected_index = 1
            testing_content = create_testing_lab_view()
            main_content_area.controls.append(testing_content)

        elif e.route == "/settings":
            rail.selected_index = 2
            settings_content, settings_controls = create_settings_view_content(
                controller
            )
            main_content_area.controls.append(settings_content)
            controller.view_controls = settings_controls

            controller.load_api_keys()

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
