import ebooklib
from ebooklib import epub
from bs4 import BeautifulSoup
import logging 


def _clean_html_content(html_content):
    if not html_content:
        return ""
    try:
        soup = BeautifulSoup(html_content, 'html.parser')

        body = soup.find('body')
        if not body:
            return soup.get_text(separator=' ', strip=True)

        text = body.get_text(separator=' ', strip=True)
        return text
    except Exception as e:
        logging.error(f"BeautifulSoup Error parsing HTML: {e}")
        return "" 

def parse_epub(file_path):
    try:
        book = epub.read_epub(file_path)
        chapters_text = []

        items = list(book.get_items_of_type(ebooklib.ITEM_DOCUMENT))

        if not items:
            logging.warning(f"No document items found in EPUB: {file_path}")
            return False, "EPUB parsing error: No text documents found in the book's spine."

        logging.info(f"Found {len(items)} document items in EPUB spine.")

        for item in items:
            html_content = item.get_content()
            plain_text = _clean_html_content(html_content)
            if plain_text: 
                chapters_text.append(plain_text)
            else:
                logging.warning(f"Could not extract text from item: {item.get_name()}")

        if not chapters_text:
            logging.error(f"Failed to extract any text content from EPUB: {file_path}")
            return False, "EPUB parsing error: Could not extract text from any chapter."

        logging.info(f"Successfully extracted text from {len(chapters_text)} chapters.")
        return True, chapters_text 

    except FileNotFoundError:
        logging.error(f"EPUB file not found: {file_path}")
        return False, "Error: EPUB file not found."
    except epub.EpubException as e:
        logging.error(f"EbookLib Error reading EPUB {file_path}: {e}")
        return False, f"EPUB parsing error: {e}"
    except Exception as e:
        logging.error(f"Unexpected error parsing EPUB {file_path}: {e}")
        return False, f"An unexpected error occurred during parsing: {e}"

