class AppState:
    """A single class to hold application state."""

    def __init__(self):
        self.active_config_name = None
        self.epub_data = {
            "title": "N/A",
            "author": "N/A",
            "chapters_meta": [],
        }

    def reset_epub_data(self):
        """Resets the EPUB data to its default state"""
        self.epub_data = {
            "title": "N/A",
            "author": "N/A",
            "chapters_meta": [],
        }
