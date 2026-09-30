import os
import uuid
import shutil
from pathlib import Path
from fastapi import UploadFile, HTTPException
from backend.core.config import settings
from backend.models.document import DocumentResponse

UPLOAD_DIR = Path("data/streammind_uploads")
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt", ".md"}

class DocumentService:
    @staticmethod
    async def upload_document(file: UploadFile, db) -> DocumentResponse:
        # 1. Validate empty file
        if not file.filename:
            raise HTTPException(status_code=400, detail="No filename provided")

        # 2. Validate file extension
        ext = Path(file.filename).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported file type. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"
            )

        # 3. Read file content to memory/disk and check size
        # We read chunk by chunk to prevent loading huge files completely into memory if not needed,
        # but since we need to save it, we can just save it and check size, or check size first if available.
        
        # In newer FastAPI, file.size is populated
        if hasattr(file, "size") and file.size is not None:
            if file.size > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
                raise HTTPException(status_code=400, detail=f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE_MB}MB")
            if file.size == 0:
                raise HTTPException(status_code=400, detail="Empty file is not allowed")
                
        # 4. Generate unique ID and safe stored filename
        doc_id = str(uuid.uuid4())
        stored_filename = f"{doc_id}{ext}"
        
        # 5. Ensure directory exists
        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        
        # 6. Save the file safely
        file_path = UPLOAD_DIR / stored_filename
        
        size_bytes = 0
        try:
            with open(file_path, "wb") as buffer:
                while True:
                    chunk = await file.read(1024 * 1024) # 1MB chunks
                    if not chunk:
                        break
                    size_bytes += len(chunk)
                    buffer.write(chunk)
                    
                    if size_bytes > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
                        # Clean up if it exceeds size during read (if file.size wasn't set)
                        buffer.close()
                        file_path.unlink()
                        raise HTTPException(status_code=400, detail=f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE_MB}MB")
                        
            if size_bytes == 0:
                file_path.unlink()
                raise HTTPException(status_code=400, detail="Empty file is not allowed")
                
        except Exception as e:
            if file_path.exists():
                file_path.unlink()
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(status_code=500, detail=f"Error saving file: {str(e)}")

        response = DocumentResponse(
            id=doc_id,
            original_name=Path(file.filename).name, # Sanitizes path traversal by extracting just the name
            stored_name=stored_filename,
            extension=ext,
            size_bytes=size_bytes,
            status="uploaded"
        )
        
        # Save simple local metadata record for extraction phase
        metadata_path = UPLOAD_DIR / f"{doc_id}.json"
        with open(metadata_path, "w", encoding="utf-8") as f:
            f.write(response.model_dump_json(indent=2))
            
        # Save to database
        from backend.services.database_service import DatabaseService
        DatabaseService.save_document(db, response.model_dump())
        
        # Phase 15: Audit log
        from backend.services.audit_service import AuditService
        from backend.models.audit import AuditEventType
        AuditService.record_event(
            db=db,
            event_type=AuditEventType.DOCUMENT_UPLOADED.value,
            title="Document Uploaded",
            entity_type="document",
            entity_id=doc_id,
            source_document_id=doc_id,
            metadata={
                "original_name": response.original_name,
                "size_bytes": size_bytes,
                "extension": ext
            }
        )
        db.commit()
            
        return response

