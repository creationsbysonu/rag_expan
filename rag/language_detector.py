"""
Language detection utility for detecting English vs Nepali text
"""
import re
from typing import Literal

def detect_language(text: str) -> Literal["en", "ne"]:
    """
    Detect if the text is in English or Nepali.
    
    Args:
        text: The input text to analyze
        
    Returns:
        "en" for English, "ne" for Nepali
    """
    if not text or not text.strip():
        return "ne"  # Default to Nepali for empty text
    
    # Count Devanagari characters (Nepali script)
    devanagari_pattern = r'[\u0900-\u097F]'
    devanagari_chars = len(re.findall(devanagari_pattern, text))
    
    # Count Latin alphabet characters (English)
    latin_pattern = r'[a-zA-Z]'
    latin_chars = len(re.findall(latin_pattern, text))
    
    # Count total meaningful characters (excluding spaces, numbers, punctuation)
    total_chars = devanagari_chars + latin_chars
    
    # If no meaningful characters, default to Nepali
    if total_chars == 0:
        return "ne"
    
    # Calculate percentages
    devanagari_percent = (devanagari_chars / total_chars) * 100
    latin_percent = (latin_chars / total_chars) * 100
    
    # Decision logic:
    # If more than 30% is Devanagari, it's Nepali
    # If more than 60% is Latin, it's English
    # Mixed or transliterated text defaults to Nepali
    
    if devanagari_percent > 30:
        return "ne"
    elif latin_percent > 60:
        return "en"
    else:
        # For mixed or uncertain cases, check for common Nepali romanization patterns
        romanized_nepali_words = [
            'kun', 'chai', 'ma', 'ko', 'ki', 'lai', 'ka', 'bata', 'gareko', 
            'bhako', 'barema', 'sambandhi', 'suchana', 'ghataana', 'taalim',
            'karyakram', 'mantralaya', 'mahanagar', 'abhimukhi', 'haleko'
        ]
        text_lower = text.lower()
        has_romanized = any(word in text_lower for word in romanized_nepali_words)
        
        if has_romanized:
            return "ne"
        
        # Default to English if mostly Latin characters
        if latin_percent >= devanagari_percent:
            return "en"
        else:
            return "ne"


def get_language_name(lang_code: str) -> str:
    """
    Get the full language name from language code.
    
    Args:
        lang_code: "en" or "ne"
        
    Returns:
        Full language name
    """
    return "English" if lang_code == "en" else "Nepali"
