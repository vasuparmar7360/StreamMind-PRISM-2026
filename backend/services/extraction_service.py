import re
import json
import logging
from typing import List, Optional, Dict, Any
import httpx
from pydantic import ValidationError
from backend.core.config import settings
from backend.db.models import DocumentChunk
from backend.models.decision import DecisionCandidate
from backend.db.models import ActionProposal, Fact, Entity

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are OwnMind AI Project Extractor.
Your task is to comprehensively analyze the provided text chunks and extract Entities, Facts, Decisions, and Action Items into structured JSON.

CRITICAL RULES:
1. ENTITIES: Extract named entities (people, organizations, locations, projects, software components).
2. FACTS: Extract objectively stated factual statements and definitions.
3. DECISIONS: Extract ONLY confirmed, authoritative project decisions (dates, architectures, stacks).
   - Ignore discussions, options, "considered", "may be".
   - If a decision replaces an older one, set replaces_previous to true and list previous_value.
4. ACTION ITEMS: Extract explicit tasks, todos, and deadlines.
   - Assign to an owner if mentioned.
5. EVERY extracted item MUST include the exact `evidence_text` used to derive it. DO NOT hallucinate.
6. Return a STRICT JSON object conforming to this structure:
{
  "entities": [
    {"name": "Flutter", "entity_type": "technology", "description": "Mobile client framework", "evidence_text": "Flutter was approved."}
  ],
  "facts": [
    {"content": "The pilot field site is located in the Ramanagara test zone.", "evidence_text": "Pilot field site: Ramanagara test zone"}
  ],
  "decisions": [
    {
      "is_decision": true,
      "topic": "Mobile client",
      "normalized_topic": "mobile_client",
      "value": "Flutter",
      "reason": "cross-platform performance",
      "replaces_previous": false,
      "previous_value": null,
      "effective_date": "21 September",
      "evidence_text": "We have approved Flutter as the mobile client."
    }
  ],
  "action_items": [
    {
      "title": "Send revised demo brief",
      "description": "Send the revised demo brief to the team before 8 October",
      "owner": "Vasu",
      "deadline": "8 October",
      "evidence_text": "Vasu should send the revised demo brief to the team before 8 October."
    }
  ]
}
Output JSON only. Do not include markdown blocks.
"""

class ExtractionService:
    @staticmethod
    def extract_source_date(doc_name: str, text: str) -> Optional[str]:
        fn_match = re.search(r"(\d{1,2})\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*", doc_name, re.IGNORECASE)
        if fn_match:
            day, month = fn_match.groups()
            month_map = {
                "jan": "January", "feb": "February", "mar": "March", "apr": "April",
                "may": "May", "jun": "June", "jul": "July", "aug": "August",
                "sep": "September", "oct": "October", "nov": "November", "dec": "December"
            }
            return f"{day} {month_map.get(month.lower()[:3], month)}"
        date_match = re.search(r"(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)(?:\s+\d{4})?)", text, re.IGNORECASE)
        if date_match:
            return date_match.group(1).strip()
        return None

    @staticmethod
    async def extract_all(document_id: str, doc_name: str, chunks: List[DocumentChunk]) -> Dict[str, List[Any]]:
        ollama_available = False
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                res = await client.get(f"{settings.OLLAMA_BASE_URL}/")
                ollama_available = (res.status_code == 200)
        except Exception:
            ollama_available = False

        if not ollama_available:
            logger.error("Ollama is not available.")
            return {"entities": [], "facts": [], "decisions": [], "action_items": []}

        combined_text = "\n\n".join([f"[Chunk {c.chunk_index}]: {c.text}" for c in chunks])
        user_prompt = f"Document: {doc_name}\n\nProject Evidence Chunks:\n{combined_text}"

        url = f"{settings.OLLAMA_BASE_URL}/api/chat"
        payload = {
            "model": settings.CHAT_MODEL,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt}
            ],
            "stream": False,
            "format": "json",
            "options": {"temperature": 0.0}
        }

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                data = response.json()
                raw_content = data.get("message", {}).get("content", "").strip()
                logger.info(f"Raw LLM Output for {document_id}: {raw_content}")
                return ExtractionService._parse_and_validate_json(raw_content, chunks, document_id, doc_name)
        except Exception as e:
            logger.error(f"LLM extraction failed: {e}")
            return {"entities": [], "facts": [], "decisions": [], "action_items": []}

    @staticmethod
    def _parse_and_validate_json(raw_json: str, chunks: List[DocumentChunk], document_id: str, doc_name: str) -> Dict[str, List[Any]]:
        cleaned = raw_json.strip()
        if cleaned.startswith("```json"): cleaned = cleaned[7:]
        elif cleaned.startswith("```"): cleaned = cleaned[3:]
        if cleaned.endswith("```"): cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        try:
            parsed = json.loads(cleaned)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM output: {e}\nRaw JSON: {cleaned}")
            return {"entities": [], "facts": [], "decisions": [], "action_items": []}

        detected_date = ExtractionService.extract_source_date(doc_name, " ".join(c.text for c in chunks))

        def find_chunk_id(evidence: str) -> Optional[str]:
            if not evidence: return None
            for chunk in chunks:
                if evidence in chunk.text or chunk.text in evidence:
                    return chunk.chunk_id
            return chunks[0].chunk_id if chunks else None

        results = {"entities": [], "facts": [], "decisions": [], "action_items": []}
        
        for d in parsed.get("decisions", []):
            if d.get("is_decision"):
                d["source_chunk_id"] = find_chunk_id(d.get("evidence_text"))
                if not d.get("effective_date") and detected_date:
                    d["effective_date"] = detected_date
                try:
                    results["decisions"].append(DecisionCandidate(**d))
                except Exception as e:
                    logger.warning(f"Validation error for decision: {e}")
                    
        for e in parsed.get("entities", []):
            e["source_chunk_id"] = find_chunk_id(e.get("evidence_text"))
            results["entities"].append(e)

        for f in parsed.get("facts", []):
            f["source_chunk_id"] = find_chunk_id(f.get("evidence_text"))
            results["facts"].append(f)
            
        for a in parsed.get("action_items", []):
            a["source_chunk_id"] = find_chunk_id(a.get("evidence_text"))
            results["action_items"].append(a)

        return results
