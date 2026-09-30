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
                content = data["message"]["content"].strip()
                timings = {
                    "load_duration": data.get("load_duration", 0) / 1e9,
                    "prompt_eval_duration": data.get("prompt_eval_duration", 0) / 1e9,
                    "eval_duration": data.get("eval_duration", 0) / 1e9,
                    "total_duration": data.get("total_duration", 0) / 1e9,
                }
                return content, timings
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

    @staticmethod
    async def evaluate_evidence(subquestion: str, chunks: list[dict]) -> tuple[list[str], str]:
        """
        Evaluates early evidence against the subquestion to ensure requested facts and constraints (dates, negations) are met.
        Returns a tuple of (valid_chunk_ids, reason).
        """
        if not chunks:
            return {"supported": False, "matching_chunk_ids": [], "reason": "No chunks provided"}
            
        system_instruction = (
            "You are a strict data extractor.\n"
            "Evaluate if any of the provided text chunks explicitly contain the answer to the question.\n"
            "If they do, set supported to true. If none contain the answer, set supported to false.\n"
            "Respond ONLY in JSON format:\n"
            "{\n"
            "  \"supported\": true or false,\n"
            "  \"reason\": \"Brief explanation of what was found or missing.\"\n"
            "}"
        )
        
        supplied_ids = set()
        chunks_text = []
        debug_info = []
        for c in chunks:
            supplied_ids.add(c['chunk_id'])
            # Explicit truncation for the validator
            text = c['text'][:1500] + ("..." if len(c['text']) > 1500 else "")
            chunks_text.append(f"--- CHUNK ID: {c['chunk_id']} ---\n{text}")
            debug_info.append({"chunk_id": c['chunk_id'], "length": len(c['text'])})
            
        chunks_text_str = "\n\n".join(chunks_text)
        user_prompt = f"Question: {subquestion}\n\nChunks:\n{chunks_text_str}"
        
        url = f"{settings.OLLAMA_BASE_URL}/api/chat"
        payload = {
            "model": settings.CHAT_MODEL,
            "messages": [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": user_prompt}
            ],
            "stream": False,
            "format": "json",
            "options": {"temperature": 0.0}
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                data = response.json()
                content = data["message"]["content"].strip()
                import json
                parsed = json.loads(content)
                print(f"\n[DEBUG EVALUATE EVIDENCE] subquestion: {subquestion}")
                print(f"[DEBUG EVALUATE EVIDENCE] chunks:")
                for c in chunks:
                    print(f"  - ID: {c['chunk_id']}, text: {c['text'][:100]}...")
                print(f"[DEBUG EVALUATE EVIDENCE] parsed output: {parsed}")
                supported = parsed.get("supported", False)
                
                # Small LLMs hallucinate UUIDs, so if it's supported, we just return all supplied chunks
                valid_ids = list(supplied_ids) if supported else []
                reason = parsed.get("reason", "No reason provided")
                
                logger.info(f"Validator Debug: input_chunks={debug_info}, supported={supported}, valid_filtered={valid_ids}, reason={reason}")
                return {"supported": supported, "matching_chunk_ids": valid_ids, "reason": reason}
        except Exception as e:
            logger.error(f"Error evaluating evidence: {e}")
            return {"supported": False, "matching_chunk_ids": [], "reason": f"Evaluation failed: {e}"}

    @staticmethod
    async def decompose_query(query: str) -> dict:
        """
        Decomposes a complex query into structured subquestions.
        Returns a dict with a "subquestions" list.
        """
        system_instruction = (
            "You are an AI assistant that decomposes complex user queries into structured subquestions. "
            "You MUST output STRICT JSON only. "
            "Identify distinct information needs. "
            "CRITICAL: You MUST preserve ALL constraints (dates, years, quarters, entities, numbers) in the subquestion text. "
            "For example, if the query asks for 'Alpha project budget for Q3 2025', the subquestion MUST include 'Q3 2025'. "
            "Do not oversplit simple queries with 'and' if they refer to the same entity constraint. "
            "Return JSON matching this schema: "
            "{"
            "  \"subquestions\": ["
            "    {\"id\": \"sq1\", \"text\": \"...\", \"entities\": [\"...\"]}"
            "  ]"
            "}"
        )
        
        user_prompt = f"Query: {query}"
        
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
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                data = response.json()
                import json
                parsed = json.loads(data["message"]["content"].strip())
                timings = {
                    "load_duration": data.get("load_duration", 0) / 1e9,
                    "prompt_eval_duration": data.get("prompt_eval_duration", 0) / 1e9,
                    "eval_duration": data.get("eval_duration", 0) / 1e9,
                    "total_duration": data.get("total_duration", 0) / 1e9,
                }
                return parsed, timings
        except Exception as e:
            logger.error(f"Error calling local LLM for decomposition: {e}")
            raise HTTPException(status_code=500, detail="Error decomposing query.")

    @staticmethod
    async def classify_followup(current_goal: str, subquestions: dict, follow_up: str) -> dict:
        """
        Classifies a follow-up query against the current conversation state.
        Returns a dict matching the follow-up schema.
        """
        system_instruction = (
            "You are an AI assistant that classifies follow-up queries in a conversation. "
            "You MUST output STRICT JSON only. "
            "Categories: 'new_topic', 'added_info', 'changed_constraint', 'removed_info', 'presentation_only', 'ambiguous'. "
            "CRITICAL: If the user changes a date, time, entity, or constraint (e.g., 'Use Q3 instead', 'What about 2025?'), use 'changed_constraint'. "
            "CRITICAL: If the user adds a question or modifies the current one, use 'added_info' or 'changed_constraint'. Do NOT use 'new_topic' unless the follow-up is completely unrelated to the current goal. "
            "EXAMPLES:\n"
            "- Follow-up: 'Use Q3 2025 for Alpha's budget instead; keep the Beta lead question.' -> 'changed_constraint'\n"
            "- Follow-up: 'What is the weather in Tokyo?' -> 'new_topic'\n"
            "- Follow-up: 'Also what is the Gamma deadline?' -> 'added_info'\n"
            "If the request is ambiguous, set clarification_needed to a short question. "
            "If the request is to format, shorten, or translate the existing answer, use 'presentation_only'. "
            "Return JSON matching this schema: "
            "{"
            "  \"category\": \"...\", "
            "  \"clarification_needed\": \"... or null\", "
            "  \"plan\": \"...\", "
            "  \"affected_subquestion_ids\": [\"sq1\", ...] "
            "}"
        )
        
        sq_text = "\n".join([f"{sq_id}: {sq.text}" for sq_id, sq in subquestions.items()])
        user_prompt = (
            f"Current Goal: {current_goal}\n"
            f"Active Subquestions:\n{sq_text}\n"
            f"Follow-up: {follow_up}"
        )
        
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
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                data = response.json()
                import json
                return json.loads(data["message"]["content"].strip())
        except Exception as e:
            logger.error(f"Error classifying follow-up: {e}")
            import traceback
            traceback.print_exc()
            # Fallback
            return {
                "category": "new_topic",
                "plan": f"Fallback due to classification error: {e}",
                "affected_subquestion_ids": []
            }

    @staticmethod
    async def rewrite_goal(current_goal: str, follow_up: str) -> str:
        """
        Rewrites a current goal and a follow-up update into a single standalone query.
        """
        system_instruction = (
            "You are an AI assistant that rewrites a user's conversational goal based on a follow-up update. "
            "You MUST output STRICT JSON only. "
            "Integrate the Follow-up update into the Current Goal to produce a single, complete, standalone question. "
            "Do NOT include conversational filler like 'keep' or 'instead'. Just state the final information needs clearly. "
            "Return JSON matching this schema: "
            "{"
            "  \"new_goal\": \"...\" "
            "}"
        )
        
        user_prompt = f"Current Goal: {current_goal}\nFollow-up: {follow_up}"
        
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
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                data = response.json()
                import json
                return json.loads(data["message"]["content"].strip())["new_goal"]
        except Exception as e:
            logger.error(f"Error rewriting goal: {e}")
            return f"{current_goal} (Update: {follow_up})"

    @staticmethod
    async def build_update_plan(current_goal: str, subquestions: dict, follow_up: str) -> dict:
        """
        Builds an explicit update plan for the active subquestions.
        Returns a dict mapping old subquestion IDs to their fate (retained, removed) and lists new subquestions.
        """
        system_instruction = (
            "You are an AI assistant that builds an explicit update plan for active subquestions based on a follow-up query. "
            "You MUST output STRICT JSON only. "
            "Determine the NEW overall goal by applying the follow-up to the Current Goal. "
            "Then, for each Active Subquestion, determine if its intent is still needed unchanged (retained), "
            "or if it is no longer relevant/accurate (removed). "
            "Finally, provide any newly added subquestions required to fulfill the new goal. "
            "Return JSON matching this schema:\n"
            "{\n"
            "  \"new_goal\": \"...\",\n"
            "  \"retained_ids\": [\"sq1\", ...],\n"
            "  \"removed_ids\": [\"sq2\", ...],\n"
            "  \"new_subquestions\": [{\"text\": \"...\", \"entities\": [\"...\"]}]\n"
            "}\n"
            "EXAMPLE:\n"
            "Current Goal: 'What is the Alpha budget and who leads Beta?'\n"
            "Follow-up: 'Use Q3 2025 for Alpha instead; keep Beta lead.'\n"
            "-> \n"
            "{\n"
            "  \"new_goal\": \"What is the Alpha project budget for Q3 2025 and who leads the Beta project?\",\n"
            "  \"retained_ids\": [\"<id of Beta lead>\"],\n"
            "  \"removed_ids\": [\"<id of Alpha budget>\"],\n"
            "  \"new_subquestions\": [{\"text\": \"What is the Alpha project budget for Q3 2025?\", \"entities\": []}]\n"
            "}"
        )
        
        sq_text = "\n".join([f"ID: {sq_id} | Text: {sq.text}" for sq_id, sq in subquestions.items()])
        user_prompt = (
            f"Current Goal: {current_goal}\n"
            f"Active Subquestions:\n{sq_text}\n"
            f"Follow-up: {follow_up}"
        )
        
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
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                data = response.json()
                import json
                return json.loads(data["message"]["content"].strip())
        except Exception as e:
            logger.error(f"Error building update plan: {e}")
            return {
                "new_goal": f"{current_goal} (Update: {follow_up})",
                "retained_ids": [],
                "removed_ids": list(subquestions.keys()),
                "new_subquestions": [{"text": f"{current_goal} (Update: {follow_up})", "entities": []}]
            }
