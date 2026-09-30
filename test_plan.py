import asyncio
from backend.services.llm_service import LLMService

async def test():
    current_goal = "What is the Alpha project budget and who leads the Beta project?"
    old_sq = {
        "sq_a1": type("Sq", (), {"text": "What is the Alpha project budget?"})(),
        "sq_b2": type("Sq", (), {"text": "Who leads the Beta project?"})()
    }
    follow_up = "Use Q3 2025 for Alpha's budget instead; keep the Beta lead question."
    
    plan = await LLMService.build_update_plan(current_goal, old_sq, follow_up)
    print("PLAN:")
    import json
    print(json.dumps(plan, indent=2))

asyncio.run(test())
