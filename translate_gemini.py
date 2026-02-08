from rag.models import GeminiGenerator
import os
import asyncio

gemini = GeminiGenerator(api_key=os.getenv("GOOGLE_GEMINI_API_KEY"))

async def translate_with_gemini(nepali_text: str) -> str:
    prompt = f"Translate the following Nepali text to English.\n\nNepali: {nepali_text}\n\nEnglish:"
    # GeminiGenerator is sync, so run in thread
    loop = asyncio.get_event_loop()
    english = await loop.run_in_executor(None, gemini.generate, prompt)
    return english
