"""
Response quality validation module.
Validates that generated answers are high quality and address the question.
"""
from typing import Dict, List, Any
import re


def validate_response_quality(
    question: str, 
    answer: str, 
    sources: List[Dict[str, Any]],
    language: str = "ne"
) -> Dict[str, Any]:
    """
    Validate the quality of a generated response.
    
    Args:
        question: User's original question
        answer: Generated answer
        sources: Retrieved source chunks
        language: Response language (en/ne)
    
    Returns:
        dict with:
            - is_valid: bool
            - quality_score: 0-100
            - issues: list of detected issues
            - warnings: list of potential concerns
    """
    issues = []
    warnings = []
    
    # Check 1: Answer should be substantive (not too short)
    word_count = len(answer.split())
    if word_count < 10:
        issues.append("Answer too short (< 10 words)")
    elif word_count < 20:
        warnings.append("Answer may be too brief")
    
    # Check 2: Answer should not be generic fallback message
    fallback_patterns = [
        "यस विषयमा आधिकारिक जानकारी उपलब्ध छैन",
        "No official information available",
        "I don't have information",
        "मसँग जानकारी छैन"
    ]
    if any(pattern in answer for pattern in fallback_patterns):
        issues.append("Answer is generic fallback message")
    
    # Check 3: Answer should be in requested language
    # Count Devanagari vs Latin characters
    devanagari_chars = sum(1 for c in answer if '\u0900' <= c <= '\u097F')
    latin_chars = sum(1 for c in answer if ('a' <= c.lower() <= 'z'))
    total_chars = devanagari_chars + latin_chars
    
    if total_chars > 0:
        nepali_ratio = devanagari_chars / total_chars
        if language == "ne" and nepali_ratio < 0.3:
            warnings.append(f"Low Nepali content ({nepali_ratio*100:.0f}% Devanagari)")
        elif language == "en" and nepali_ratio > 0.3:
            warnings.append(f"Unexpected Nepali content ({nepali_ratio*100:.0f}% Devanagari)")
    
    # Check 4: Answer should be related to sources (if sources exist)
    if sources and len(sources) > 0:
        # Extract key terms from sources
        source_texts = [src.get('text', '') for src in sources]
        source_combined = ' '.join(source_texts)
        
        # Check if answer uses ANY content from sources
        # Simple heuristic: check if at least some source words appear in answer
        source_words = set(source_combined.lower().split()[:100])  # First 100 words
        answer_words = set(answer.lower().split())
        
        # Calculate overlap
        overlap = len(source_words & answer_words)
        if overlap < 3:
            warnings.append("Answer may not use provided sources")
    
    # Check 5: Answer should not just repeat the question
    question_words = set(question.lower().split())
    answer_words = set(answer.lower().split())
    if len(question_words) > 3:  # Only check for non-trivial questions
        question_in_answer_ratio = len(question_words & answer_words) / len(question_words)
        if question_in_answer_ratio > 0.8:
            warnings.append("Answer mostly repeats the question")
    
    # Check 6: Check for common issues
    if answer.count('\n\n\n') > 2:
        warnings.append("Excessive whitespace in answer")
    
    if len(answer) > 2000:
        warnings.append("Answer very long (> 2000 chars) - may be verbose")
    
    # Calculate quality score (0-100)
    quality_score = 100
    quality_score -= len(issues) * 30  # Each issue: -30 points
    quality_score -= len(warnings) * 10  # Each warning: -10 points
    quality_score = max(0, min(100, quality_score))  # Clamp to 0-100
    
    # Determine if valid (no critical issues)
    is_valid = len(issues) == 0
    
    return {
        "is_valid": is_valid,
        "quality_score": quality_score,
        "issues": issues,
        "warnings": warnings,
        "metrics": {
            "word_count": word_count,
            "char_count": len(answer),
            "source_count": len(sources) if sources else 0
        }
    }


def extract_highlighted_excerpts(
    sources: List[Dict[str, Any]], 
    max_excerpt_length: int = 200
) -> List[Dict[str, Any]]:
    """
    Extract highlighted excerpts from source documents.
    
    Args:
        sources: List of source chunks
        max_excerpt_length: Maximum length of excerpt
    
    Returns:
        List of sources with added 'excerpt' field
    """
    enhanced_sources = []
    
    for src in sources:
        text = src.get('text', '')
        meta = src.get('meta', {})
        
        # Create excerpt (first N chars or first sentence)
        excerpt = text[:max_excerpt_length]
        if len(text) > max_excerpt_length:
            # Try to end at sentence boundary
            for delimiter in ['।', '.', '!', '?']:
                if delimiter in excerpt:
                    parts = excerpt.rsplit(delimiter, 1)
                    excerpt = parts[0] + delimiter
                    break
            else:
                excerpt += "..."
        
        enhanced_sources.append({
            **src,
            "excerpt": excerpt.strip(),
            "confidence": src.get('score', 0.0),  # Use retrieval score as confidence
            "notice_id": meta.get('notice_id'),
            "title": meta.get('title'),
            "page": meta.get('page', 'N/A')
        })
    
    return enhanced_sources


def generate_quality_report(validation_result: Dict[str, Any]) -> str:
    """
    Generate human-readable quality report.
    
    Args:
        validation_result: Result from validate_response_quality()
    
    Returns:
        Formatted quality report string
    """
    score = validation_result['quality_score']
    is_valid = validation_result['is_valid']
    issues = validation_result['issues']
    warnings = validation_result['warnings']
    
    report = f"Quality Score: {score}/100\n"
    report += f"Status: {'✓ VALID' if is_valid else '✗ INVALID'}\n\n"
    
    if issues:
        report += "Issues:\n"
        for issue in issues:
            report += f"  ✗ {issue}\n"
    
    if warnings:
        report += "\nWarnings:\n"
        for warning in warnings:
            report += f"  ⚠ {warning}\n"
    
    return report
