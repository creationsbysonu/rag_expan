from fastapi import Body
from translate_utils import translate_to_english

# Dummy endpoint for Nepali translation (to be replaced with real model if needed)
from googletrans import Translator
translator = Translator()

async def translate_to_nepali(english_text: str) -> str:
    # Use googletrans for demonstration (offline, not production ready)
    try:
        result = translator.translate(english_text, src='en', dest='ne')
        return result.text
    except Exception:
        return "[Translation unavailable]"

# FastAPI endpoint for translation to Nepali
from fastapi import APIRouter
router = APIRouter()

@router.post("/translate_to_nepali")
async def translate_to_nepali_endpoint(answer: str = Body(..., embed=True)):
    nepali = await translate_to_nepali(answer)
    return {"original": answer, "nepali": nepali}
