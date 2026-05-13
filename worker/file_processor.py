import os
import logging
import requests
import tempfile
import fitz  # pymupdf
import cloudinary
import cloudinary.uploader

logger = logging.getLogger(__name__)

cloudinary.config(
    cloud_name=os.getenv('CLOUDINARY_CLOUD_NAME'),
    api_key=os.getenv('CLOUDINARY_API_KEY'),
    api_secret=os.getenv('CLOUDINARY_API_SECRET'),
)

MAX_PDF_CHARS = 80_000  # ~20k tokens, safe for all providers


def extract_pdf_text(file_url: str) -> str:
    """Download PDF from Cloudinary and extract text."""
    try:
        response = requests.get(file_url, timeout=30)
        response.raise_for_status()

        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
            tmp.write(response.content)
            tmp_path = tmp.name

        try:
            doc = fitz.open(tmp_path)
            text_parts = []
            for page in doc:
                text_parts.append(page.get_text())
            doc.close()
            text = '\n'.join(text_parts).strip()

            if len(text) > MAX_PDF_CHARS:
                text = text[:MAX_PDF_CHARS]
                text += '\n\n[Note: Document truncated to fit processing limits]'

            return text
        finally:
            os.unlink(tmp_path)

    except Exception as e:
        logger.error(f'PDF extraction failed: {e}')
        raise


def get_image_base64(file_url: str) -> dict:
    """Download image and return base64 for Gemini."""
    import base64
    try:
        response = requests.get(file_url, timeout=30)
        response.raise_for_status()
        content_type = response.headers.get('content-type', 'image/jpeg')
        return {'data': response.content, 'mime_type': content_type}
    except Exception as e:
        logger.error(f'Image download failed: {e}')
        raise