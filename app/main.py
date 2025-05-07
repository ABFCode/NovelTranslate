import flet as ft

from app.ui.settings_view import create_settings_view_content


def create_novel_project_view():
    return ft.Column(
        [ft.Text("Novel / Project View Content", size=20)],
        alignment=ft.MainAxisAlignment.CENTER,
        horizontal_alignment=ft.CrossAxisAlignment.CENTER,
        expand=True,
    )


def create_testing_lab_view():
    return ft.Column(
        [ft.Text("Advanced Testing Lab View Content", size=20)],
        alignment=ft.MainAxisAlignment.CENTER,
        horizontal_alignment=ft.CrossAxisAlignment.CENTER,
        expand=True,
    )


def main(page: ft.Page):
    current_view_controls = None

    page.title = "NovelTranslate"
    page.vertical_alignment = ft.MainAxisAlignment.START
    page.horizontal_alignment = ft.CrossAxisAlignment.START

    main_content_area = ft.Column([create_novel_project_view()], expand=True)

    def navigation_changed(e):
        nonlocal current_view_controls
        selected_index = e.control.selected_index
        main_content_area.controls.clear()
        current_view_controls = None

        if selected_index == 0:
            novel_content = create_novel_project_view()
            main_content_area.controls.append(novel_content)
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


if __name__ == "__main__":
    ft.app(target=main)
