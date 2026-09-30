import asyncio
from backend.services.llm_service import LLMService

async def test():
    query = "What is the Alpha project budget for Q3 2025 and who leads the Beta project?"
    user_prompt = f"Query: {query}"
    system_instruction = (
        "You are an AI assistant that decomposes complex user queries into structured subquestions. "
        "You MUST output STRICT JSON only. "
        "Identify distinct information needs. Do not oversplit simple queries with 'and' if they refer to the same entity constraint. "
        "Return JSON matching this schema: "
        "{"
        "  \"subquestions\": ["
        "    {\"id\": \"sq1\", \"text\": \"...\", \"entities\": [\"...\"]}"
        "  ]"
        "}"
    )

    
    import httpx
    url = "http://127.0.0.1:11434/api/chat"
    payload = {
        "model": "qwen2.5:3b",
        "messages": [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": user_prompt}
        ],
        "stream": False,
        "format": "json",
        "options": {"temperature": 0.1}
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(url, json=payload)
        print(r.json()["message"]["content"])

asyncio.run(test())
