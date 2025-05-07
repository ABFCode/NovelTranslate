import flet as ft

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
        expand=True
    )

def create_settings_view():
    return ft.Column([ft.Text("Settings View Content", size=20)],
        alignment=ft.MainAxisAlignment.CENTER,
        horizontal_alignment=ft.CrossAxisAlignment.CENTER,
        expand=True
    )

def main(page: ft.Page):
    page.title = "NovelTranslate"
    page.vertical_alignment = ft.MainAxisAlignment.START
    page.horizontal_alignment = ft.CrossAxisAlignment.START


    main_content_area = ft.Column([create_novel_project_view()], expand=True)


    def navigation_changed(e):
        selected_index = e.control.selected_index
        main_content_area.controls.clear()
        if selected_index == 0:
            main_content_area.controls.append(create_novel_project_view())
        elif selected_index == 1:
            main_content_area.controls.append(create_testing_lab_view())
        elif selected_index == 2:
            main_content_area.controls.append(create_settings_view())
        page.update()
    
    rail = ft.NavigationRail(
        selected_index=0,
        label_type=ft.NavigationRailLabelType.ALL,
        min_width=100,
        min_extended_width=200,
        group_alignment=0.9,
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
            )
            
        ],
        on_change=navigation_changed,
    )

    page_layout = ft.Row([
        rail, ft.VerticalDivider(width=1),
        main_content_area
    ],
    expand=True,)

    page.add(page_layout)

if __name__ == "__main__":
    ft.app(target=main)