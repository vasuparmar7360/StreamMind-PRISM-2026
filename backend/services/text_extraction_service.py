import json
from pathlib import Path
from fastapi import HTTPException
from pypdf import PdfReader
import docx

from backend.services.document_service import UPLOAD_DIR
from backend.models.text_extraction import DocumentTextResponse

class TextExtractionService:
    @staticmethod
    def _read_metadata(document_id: str) -> dict:
        metadata_path = UPLOAD_DIR / f"{document_id}.json"
        if not metadata_path.exists():
            raise HTTPException(status_code=404, detail="Document metadata not found")
        
        try:
            with open(metadata_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            raise HTTPException(status_code=500, detail="Error reading document metadata")

    @staticmethod
    def extract_text(document_id: str) -> DocumentTextResponse:
        metadata = TextExtractionService._read_metadata(document_id)
        
        stored_name = metadata.get("stored_name")
        original_name = metadata.get("original_name", "Unknown")
        extension = metadata.get("extension", "").lower()
        
        if not stored_name:
            raise HTTPException(status_code=500, detail="Corrupt metadata: stored_name missing")
            
        file_path = UPLOAD_DIR / stored_name
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="Document file not found")
            
        if file_path.stat().st_size == 0:
            raise HTTPException(status_code=400, detail="Empty document")

        extracted_text = ""
        
        try:
            if extension in [".txt", ".md", ".markdown"]:
                with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                    extracted_text = f.read()
            elif extension == ".pdf":
                try:
                    reader = PdfReader(str(file_path))
                    text_parts = []
                    for page in reader.pages:
                        page_text = page.extract_text()
                        if page_text:
                            import re
                            page_text = re.sub(r'Page\n+(\d+)', r'Page: \1', page_text)
                            page_text = re.sub(r'Section\n+(.+)', r'Section: \1', page_text)
                            page_text = re.sub(r'Document ID\n+(.+)', r'Document ID: \1', page_text)
                            page_text = re.sub(r'Document Date\n+(.+)', r'Document Date: \1', page_text)
                            text_parts.append(page_text)
                    extracted_text = "\n".join(text_parts)
                except Exception as e:
                    raise HTTPException(status_code=400, detail=f"Failed to read PDF or corrupt PDF file: {str(e)}")
            elif extension == ".docx":
                try:
                    doc = docx.Document(str(file_path))
                    text_parts = [para.text for para in doc.paragraphs if para.text]
                    extracted_text = "\n".join(text_parts)
                except Exception as e:
                    raise HTTPException(status_code=400, detail=f"Failed to read DOCX or corrupt DOCX file: {str(e)}")
            else:
                raise HTTPException(status_code=400, detail=f"Unsupported format for extraction: {extension}")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Unexpected error during extraction: {str(e)}")

        extracted_text = extracted_text.strip()
        if not extracted_text:
            raise HTTPException(status_code=400, detail="Document contains no extractable text. OCR is required for scanned documents.")

        char_count = len(extracted_text)
        word_count = len(extracted_text.split())

        return DocumentTextResponse(
            document_id=document_id,
            original_name=original_name,
            status="extracted",
            character_count=char_count,
            word_count=word_count,
            text=extracted_text
        )
