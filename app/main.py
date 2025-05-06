import flet as ft
from app.ui.main_view import create_main_view
from app.core.epub_parser import parse_epub
from flet import FilePickerResultEvent
import logging 

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')



def main(page: ft.Page):
    parsed_chapters = []
    page.title = "NovelTranslate"
    page.vertical_alignment = ft.MainAxisAlignment.START
    page.horizontal_alignment = ft.CrossAxisAlignment.START
    page.window_width = 700
    page.window_height = 800

    main_layout, view_controls = create_main_view()


    def select_file_result(e: FilePickerResultEvent):
        nonlocal parsed_chapters 
        view_controls.selected_epub_path.value = "Processing..."
        view_controls.output_log_field.value = ""
        parsed_chapters = []
        page.update() 

        if e.files: 
            selected_file_path = e.files[0].path
            view_controls.selected_epub_path.value = f"Selected: {selected_file_path}"
            logging.info(f"File selected: {selected_file_path}")

            success, result = parse_epub(selected_file_path)

            if success:
                parsed_chapters = result 
                log_message = f"Successfully parsed EPUB.\nFound {len(parsed_chapters)} chapters.\n"
                if parsed_chapters:
                    log_message += f"\nFirst chapter preview:\n---\n{parsed_chapters[0][:300]}..."
                view_controls.output_log_field.value = log_message
                logging.info(f"EPUB parsed successfully, {len(parsed_chapters)} chapters found.")
            else:
                view_controls.selected_epub_path.value = "Error parsing file (see log)"
                view_controls.output_log_field.value = f"Error: {result}"
                logging.error(f"EPUB parsing failed: {result}")
        else:
            view_controls.selected_epub_path.value = "File selection cancelled."
            logging.info("File selection cancelled by user.")

        page.update()

    file_picker = ft.FilePicker(on_result=select_file_result)

    page.overlay.append(file_picker)
    page.update() 

    def pick_file_dialog(e):
        logging.info("Opening file picker dialog...")
        file_picker.pick_files(
            allow_multiple=False, 
            allowed_extensions=["epub"] 
        )

    view_controls.select_epub_button.on_click = pick_file_dialog

    page.add(main_layout)

if __name__ == "__main__":
    ft.app(target=main) 

