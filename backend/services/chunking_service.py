import re
from fastapi import HTTPException
from backend.core.config import settings
from backend.models.chunk import Chunk, ChunkingResponse
from backend.services.text_extraction_service import TextExtractionService

class ChunkingService:
    @staticmethod
    def chunk_document(document_id: str) -> ChunkingResponse:
        # Extract text using the existing service
        extraction_result = TextExtractionService.extract_text(document_id)
        text = extraction_result.text
        
        if not text.strip():
            raise HTTPException(status_code=400, detail="No extractable text available for chunking.")
            
        chunks_text = ChunkingService._chunk_text_logic(
            text=text, 
            chunk_size=settings.CHUNK_SIZE_WORDS, 
            chunk_overlap=settings.CHUNK_OVERLAP_WORDS
        )
        
        if not chunks_text:
            raise HTTPException(status_code=400, detail="No extractable text available for chunking.")
            
        chunks = []
        for index, chunk_str in enumerate(chunks_text):
            chunk_str = chunk_str.strip()
            if not chunk_str:
                continue
                
            chunk_id = f"{document_id}-chunk-{index + 1:04d}"
            chunks.append(Chunk(
                chunk_id=chunk_id,
                chunk_index=index,
                word_count=len(chunk_str.split()),
                character_count=len(chunk_str),
                text=chunk_str
            ))
            
        return ChunkingResponse(
            document_id=document_id,
            original_name=extraction_result.original_name,
            total_chunks=len(chunks),
            chunks=chunks
        )

    @staticmethod
    def _chunk_text_logic(text: str, chunk_size: int, chunk_overlap: int) -> list[str]:
        # Split by paragraphs (one or more newlines)
        paragraphs = [p.strip() for p in re.split(r'\n+', text) if p.strip()]
        
        if not paragraphs:
            return []
            
        chunks = []
        current_chunk_paras = []
        current_word_count = 0
        
        for para in paragraphs:
            para_word_count = len(para.split())
            
            # If a single paragraph is larger than chunk_size, we should split it by sentences
            if para_word_count > chunk_size:
                # Flush current chunk if it has content
                if current_chunk_paras:
                    chunks.append("\n\n".join(current_chunk_paras))
                    current_chunk_paras = []
                    current_word_count = 0
                    
                # Split huge paragraph by sentences roughly
                sentences = [s.strip() + "." for s in re.split(r'\.\s+', para) if s.strip()]
                
                temp_para = []
                temp_wc = 0
                for sentence in sentences:
                    swc = len(sentence.split())
                    if temp_wc + swc > chunk_size and temp_para:
                        chunks.append(" ".join(temp_para))
                        # Simple overlap for sentences: keep last few sentences
                        overlap_para = []
                        overlap_wc = 0
                        for s in reversed(temp_para):
                            if overlap_wc + len(s.split()) <= chunk_overlap:
                                overlap_para.insert(0, s)
                                overlap_wc += len(s.split())
                            else:
                                break
                        temp_para = overlap_para
                        temp_wc = overlap_wc
                        
                    temp_para.append(sentence)
                    temp_wc += swc
                    
                if temp_para:
                    # Keep as current chunk for the next paragraph to append to
                    current_chunk_paras = [" ".join(temp_para)]
                    current_word_count = temp_wc
                continue
                
            if current_word_count + para_word_count > chunk_size and current_chunk_paras:
                chunks.append("\n\n".join(current_chunk_paras))
                
                # Create overlap from the end of current_chunk_paras
                overlap_paras = []
                overlap_wc = 0
                for p in reversed(current_chunk_paras):
                    p_wc = len(p.split())
                    if overlap_wc + p_wc <= chunk_overlap:
                        overlap_paras.insert(0, p)
                        overlap_wc += p_wc
                    else:
                        break
                        
                current_chunk_paras = overlap_paras
                current_word_count = overlap_wc
                
            current_chunk_paras.append(para)
            current_word_count += para_word_count
            
        if current_chunk_paras:
            chunks.append("\n\n".join(current_chunk_paras))
            
        return chunks
