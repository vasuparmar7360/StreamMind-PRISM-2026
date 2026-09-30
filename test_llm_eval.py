import asyncio
from backend.services.llm_service import LLMService

async def main():
    chunks = [
        {
            "chunk_id": "test_doc_chunk",
            "text": "Aisha Okonkwo leads the Beta project."
        }
    ]
    res = await LLMService.evaluate_evidence("Who leads the Beta project?", chunks)
    print(res)

asyncio.run(main())
