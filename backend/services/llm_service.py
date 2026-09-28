import httpx
from fastapi import HTTPException
from backend.core.config import settings
import logging

logger = logging.getLogger(__name__)

class LLMService:
    @staticmethod
    async def generate_grounded_answer(system_instruction: str, user_prompt: str) -> str:
        """
        Sends a grounded prompt to the local Ollama Qwen model.
        Returns the generated answer.
        """
        url = f"{settings.OLLAMA_BASE_URL}/api/chat"
        payload = {
            "model": settings.CHAT_MODEL,
            "messages": [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": user_prompt}
            ],
            "stream": False,
            "options": {
                "temperature": 0.1,  # Low temperature for factual QA
            }
        }
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                data = response.json()
                return data["message"]["content"].strip()
        except httpx.ConnectError:
            logger.error("Failed to connect to local Ollama instance.")
            raise HTTPException(status_code=503, detail="Local LLM service is unavailable.")
        except Exception as e:
            logger.error(f"Error calling local LLM: {e}")
            raise HTTPException(status_code=500, detail="Error generating answer from local LLM.")

    @staticmethod
    async def generate_structured_action(decision_text: str, reason: str = None) -> str:
        """
        Asks the local Qwen model to propose an action based on a decision.
        Expects a strict JSON response.
        """
        system_instruction = (
            "You are an AI assistant that proposes structured actions based on project decisions. "
            "You MUST output STRICT JSON only. No markdown formatting, no code blocks, no explanations. "
            "Only propose an action if the decision warrants one (e.g. creating a task or saving a brief). "
            "Supported action types: 'create_task', 'save_brief'. "
            "Risk levels: 'low', 'medium', 'high'. "
            "If no action is needed, return {\"should_propose_action\": false}. "
            "If an action is needed, return JSON matching this schema: "
            "{"
            "  \"should_propose_action\": true,"
            "  \"action_type\": \"...\", "
            "  \"title\": \"...\", "
            "  \"description\": \"...\", "
            "  \"payload\": { ... }, "
            "  \"risk_level\": \"...\""
            "} "
            "For 'create_task', payload must have 'task_title' and 'notes'. "
            "For 'save_brief', payload must have 'title' and 'content'. "
        )
        
        user_prompt = f"Decision: {decision_text}\nReason: {reason or 'None'}"
        
        url = f"{settings.OLLAMA_BASE_URL}/api/chat"
        payload = {
            "model": settings.CHAT_MODEL,
            "messages": [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": user_prompt}
            ],
            "stream": False,
            "format": "json",
            "options": {
                "temperature": 0.1,
            }
        }
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                data = response.json()
                return data["message"]["content"].strip()
        except httpx.ConnectError:
            logger.error("Failed to connect to local Ollama instance.")
            raise HTTPException(status_code=503, detail="Local LLM service is unavailable.")
        except Exception as e:
            logger.error(f"Error calling local LLM for structured action: {e}")
            raise HTTPException(status_code=500, detail="Error generating structured action from local LLM.")

