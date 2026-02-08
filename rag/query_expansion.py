"""
Query expansion using LLM for intelligent cross-language understanding
"""
import os


def expand_query_with_llm(query: str, generator=None) -> list:
    """
    Use LLM to generate semantically similar queries in both languages.
    This works for ANY topic, not just predefined terms.
    
    Args:
        query: Original user query
        generator: LLM generator instance
    
    Returns:
        List of query variations for better retrieval
    """
    if not generator:
        return [query]
    
    try:
        # Ask LLM to generate variations
        prompt = f"""Generate 3 alternative ways to express this query, including both English and Nepali terms where relevant.

Original query: "{query}"

Provide ONLY the alternative queries, one per line. Be concise - each should be 5-10 words.
Focus on key concepts and their translations.

Examples:
- If query is "scholarship", generate: "छात्रवृत्ति", "scholarship program", "student financial aid"
- If query is "training", generate: "तालिम", "training program", "skill development"

Alternative queries:"""

        response = generator.generate(prompt)
        
        # Parse response into list
        variations = [query]  # Start with original
        for line in response.strip().split('\n'):
            line = line.strip()
            # Remove numbering, bullets, etc.
            line = line.lstrip('0123456789.-•* ')
            if line and len(line) > 3:
                variations.append(line)
        
        return variations[:4]  # Original + 3 variations
        
    except Exception as e:
        print(f"Query expansion error: {e}")
        return [query]


def expand_query(query: str) -> str:
    """
    Simple bilingual term detection for quick expansion.
    Works as fallback when LLM expansion is not available.
    """
    # Common terms that appear frequently in government documents
    common_terms = {
        "scholarship": "छात्रवृत्ति",
        "training": "तालिम",
        "notice": "सूचना",
        "education": "शिक्षा",
        "program": "कार्यक्रम",
        "application": "आवेदन",
        "form": "फारम",
        "registration": "दर्ता",
        "exam": "परीक्षा",
        "result": "नतिजा",
        "job": "जागिर",
        "vacancy": "रिक्त",
        "office": "कार्यालय",
        "ministry": "मन्त्रालय",
        "government": "सरकार",
    }
    
    # Reverse map
    reverse_map = {v: k for k, v in common_terms.items()}
    
    words = query.lower().split()
    expansions = []
    
    for word in words:
        clean_word = word.strip('.,!?;:')
        if clean_word in common_terms:
            expansions.append(common_terms[clean_word])
        elif clean_word in reverse_map:
            expansions.append(reverse_map[clean_word])
    
    if expansions:
        return f"{query} {' '.join(expansions)}"
    
    return query

