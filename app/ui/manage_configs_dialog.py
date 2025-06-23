import logging

import flet as ft

from app.core.config_manager import ConfigManager


class ManageConfigsDialog(ft.AlertDialog):
    def __init__(
        self,
        config_manager: ConfigManager,
        on_close_callback,
        on_add_new_callback,
        on_edit_callback,
    ):
        super().__init__()
        self.config_manager = config_manager
        self.on_close_callback = on_close_callback
        self.on_add_new_callback = on_add_new_callback
        self.on_edit_callback = on_edit_callback
        self.modal = True
        self.title = ft.Text("Manage Configurations")

        self.config_list_view = ft.ListView(expand=True, spacing=5)

        self.content = ft.Container(
            content=self.config_list_view, width=500, height=300
        )

        self.actions = [
            ft.ElevatedButton(
                "Add new", icon=ft.Icons.ADD, on_click=self.add_new_config
            ),
            ft.TextButton("Close", on_click=self.close_dialog),
        ]
        self.populate_configs()

    def populate_configs(self):
        self.config_list_view.controls.clear()
        all_configs = self.config_manager.get_all_configs()
        if not all_configs:
            self.config_list_view.controls.append(
                ft.Text("No configurations saved yet.", italic=True)
            )
        else:
            for config_name in all_configs.keys():
                config_item = self.create_config_row(config_name)
                self.config_list_view.controls.append(config_item)

        if self.page:
            self.page.update()

    def create_config_row(self, config_name: str):
        return ft.Row(
            controls=[
                ft.Text(config_name, expand=True),
                ft.IconButton(
                    icon=ft.Icons.EDIT_ROUNDED,
                    tooltip="Edit Configuration",
                    on_click=lambda e, name=config_name: self.edit_config(name),
                ),
                ft.IconButton(
                    icon=ft.Icons.DELETE_ROUNDED,
                    icon_color=ft.colors.ERROR,
                    tooltip="Delete Configuration",
                    on_click=lambda e, name=config_name: self.delete_config(name),
                ),
            ],
            alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
        )

    def add_new_config(self, e):
        self.open = False
        self.page.update()

        if self.on_add_new_callback:
            self.on_add_new_callback(e)

    def edit_config(self, config_name: str):
        logging.info(f"Edit config clicked for {config_name}")
        self.open = False
        self.page.update()
        if self.on_edit_callback:
            self.on_edit_callback(config_name)

    def delete_config(self, config_name: str):
        logging.info(f"Delete config {config_name}")
        self.config_manager.delete_config(config_name)
        self.populate_configs()

    def close_dialog(self, e):
        self.page.close(self)
        if self.on_close_callback:
            self.on_close_callback()
