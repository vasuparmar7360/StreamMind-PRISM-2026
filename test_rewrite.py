import asyncio
from backend.services.llm_service import LLMService

async def test():
    current_goal = "What is the Alpha project budget and who leads the Beta project?"
    follow_up = "Use Q3 2025 for Alpha's budget instead; keep the Beta lead question."
    
    new_goal = await LLMService.rewrite_goal(current_goal, follow_up)
    print("REWRITTEN GOAL:")
    print(new_goal)

asyncio.run(test())
