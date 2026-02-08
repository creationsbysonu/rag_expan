import httpx
import os

GOOGLE_TRANSLATE_API_KEY = os.getenv("GOOGLE_TRANSLATE_API_KEY")

async def translate_to_english(text: str) -> str:
    """Translate Nepali text to English using Google Translate API."""
    if not GOOGLE_TRANSLATE_API_KEY:
        return "[Translation unavailable: API key not set]"
    url = "https://translation.googleapis.com/language/translate/v2"
    params = {
        "q": text,
        "target": "en",
        "source": "ne",
        "format": "text",
        "key": GOOGLE_TRANSLATE_API_KEY
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, data=params)
        if resp.status_code == 200:
            data = resp.json()
            return data["data"]["translations"][0]["translatedText"]
        return f"[Translation error: {resp.status_code}]"
