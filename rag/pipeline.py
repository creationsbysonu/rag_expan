from typing import List
import re

from .config import settings
from .index import VectorIndex
from .models import EmbeddingModel, GenerativeModel
from .transliterate import normalize_query
from .cache import query_cache
from .logger import log_info, log_debug, log_error
from .query_expansion import expand_query, expand_query_with_llm

class RAGPipeline:
    def __init__(self, embedder: EmbeddingModel, generator: GenerativeModel):
        self.index = VectorIndex(embedder)
        self.generator = generator

    def build_index(self, chunks: List[str], metas: List[dict]):
        self.index.build(chunks, metas)
    
    def _clean_chunk_for_llm(self, text: str) -> str:
        """Aggressively clean chunk text to avoid triggering safety filters."""
        import re
        
        # Remove all source metadata tags first
        text = re.sub(r'\[.*?\]', '', text)
        
        # Remove OCR artifacts and gibberish patterns
        ocr_patterns = [
            r'c&\\+',
            r'\bjem\b',
            r'Ret\s+',
            r'we\s*\|',
            r'\|\s*\w{1,3}\s*\|',  # Pipe-separated short words
            r'\d+\s*\|',  # Numbers with pipes
        ]
        for pattern in ocr_patterns:
            text = re.sub(pattern, '', text, flags=re.IGNORECASE)
        
        # Remove URLs and email patterns
        text = re.sub(r'http[s]?://\S+', '', text)
        text = re.sub(r'[\w\.-]+@[\w\.-]+', '', text)
        
        # Remove excessive punctuation
        text = re.sub(r'[\.,:;]{3,}', '.', text)
        text = re.sub(r'[-_=]{3,}', ' ', text)
        
        # Remove control characters
        text = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', text)
        
        # Normalize whitespace
        text = re.sub(r'\s+', ' ', text)
        
        # Remove standalone numbers or single characters at start/end
        text = re.sub(r'^[\d\W]+|[\d\W]+$', '', text)
        
        return text.strip()

    def answer(self, question: str, conversation_history: List[dict] = None) -> str:
        """Answer a question using RAG, with conversation context awareness.
        
        Args:
            question: The user's query
            conversation_history: Previous conversation messages
        """
        conversation_history = conversation_history or []
        
        # Check cache first (only for non-context queries)
        cache_key = f"{question}_en"
        if settings.enable_cache and not conversation_history:
            cached_answer = query_cache.get(cache_key)
            if cached_answer:
                log_debug("Cache hit", query=question[:50])
                return cached_answer
        
        # Detect context-aware queries (asking about previous answer)
        context_indicators = [
            'short', 'brief', 'summary', 'summarize', 'concise',
            'previous', 'above', 'earlier', 'this', 'that',
            'simpler', 'simple', 'quick', 'quickly'
        ]
        is_context_query = any(ind in question.lower() for ind in context_indicators)
        
        # Get last assistant message from history
        last_answer = None
        last_question = None
        if conversation_history:
            for msg in reversed(conversation_history):
                if msg['role'] == 'assistant' and not last_answer:
                    last_answer = msg['content']
                elif msg['role'] == 'user' and not last_question:
                    last_question = msg['content']
                if last_answer and last_question:
                    break
        
        # Handle summarization requests intelligently
        if is_context_query and last_answer:
            summary_keywords = ['short', 'brief', 'summary', 'summarize', 'concise', 'simpler', 'simple']
            is_summary_request = any(kw in question.lower() for kw in summary_keywords)
            
            # Check if user is asking to shorten or simplify previous answer
            shortening_patterns = [
                'make it short', 'make it brief', 'make it concise',
                'shorten it', 'shorter version', 'brief version',
                'in short', 'briefly', 'concisely',
                'simpler', 'simplify'
            ]
            is_shortening_request = any(pattern in question.lower() for pattern in shortening_patterns)
            
            if is_summary_request or is_shortening_request:
                # Generate summary using LLM with clear instructions
                summary_prompt = (
                    f"Previous Question: {last_question}\n\n"
                    f"Previous Detailed Answer:\n{last_answer}\n\n"
                    f"User Request: {question}\n\n"
                    f"Instructions: The user wants a shorter/simpler version of the previous answer. "
                    f"Summarize the above detailed answer very concisely. "
                    f"Extract only the key points (3-5 main ideas). "
                    f"Remove detailed explanations and examples. "
                    f"Keep it under 150 words. "
                    f"Answer in English only.\n\n"
                    f"Concise Summary:"
                )
                
                summary = self.generator.generate(summary_prompt)
                
                # Clean summary - remove meta labels
                summary = re.sub(r'^(brief|summary|answer|response).*?:', '', summary, flags=re.IGNORECASE).strip()
                summary = re.sub(r'^(here is|here\'s).*?:', '', summary, flags=re.IGNORECASE).strip()
                
                return summary
        
        # Handle follow-up questions needing context expansion
        followup_keywords = ['more', 'detail', 'explain']
        is_followup = is_context_query and any(kw in question.lower() for kw in followup_keywords)
        
        if is_followup and last_question:
            # Enhance current question with previous context
            question = f"{last_question} - {question}"        
        # Validate input
        if not question or not question.strip():
            return "No information available on this topic."
        
        # Handle greetings naturally
        greetings = ['hi', 'hello', 'hey', 'namaste', 'greetings']
        q_lower = question.lower().strip()
        if q_lower in greetings or (len(question.split()) <= 2 and any(g in q_lower for g in greetings)):
            return ("Hello! I'm an AI assistant that can help you find information from the uploaded documents. "
                    "Feel free to ask me questions about the Constitution of Nepal or any other documents that have been uploaded. "
                    "How can I help you today?")
        
        # Check query length
        if len(question) > settings.max_query_length:
            log_error("Query too long", length=len(question))
            return f"Question too long. Please shorten it (maximum {settings.max_query_length} characters)"
        
        # Detect if user wants a brief/concise answer from the start
        brief_keywords = ['brief', 'shortly']
        wants_brief_answer = any(kw in question.lower() for kw in brief_keywords)
        
        # Normalize query (transliterate if romanized + grammar correction)
        normalized_question = normalize_query(question)
        
        # Query expansion for better retrieval
        query_variations = [normalized_question]
        
        # Common synonyms and related terms for better matching
        expansion_map = {
            'orientation': ['training', 'workshop'],
            'training': ['orientation', 'workshop', 'education'],
            'service': ['job', 'position'],
            'application': ['request', 'submission'],
            'exam': ['test', 'examination'],
            'qualification': ['eligibility', 'criteria'],
            'time': ['date', 'duration', 'period'],
            'process': ['procedure', 'method'],
            'fee': ['charge', 'cost'],
            'document': ['papers', 'files'],
            'notice': ['announcement', 'information']
        }
        
        # Find key terms in query and add variations
        query_lower = normalized_question.lower()
        expanded_terms = set()
        for term, synonyms in expansion_map.items():
            if term in query_lower:
                expanded_terms.update([term] + synonyms[:2])
        
        # Use the original question for LLM
        llm_question = question
        
        # Detect if this is a comprehensive query needing more chunks
        comprehensive_indicators = ['all', 'complete', 'full', 'list', 'every', 'entire']
        is_comprehensive = any(indicator in question.lower() or indicator in normalized_question.lower() for indicator in comprehensive_indicators)
        
        if is_comprehensive:
            retrieval_multiplier = 3
        else:
            retrieval_multiplier = 1
        
        # === INTELLIGENT CROSS-LANGUAGE QUERY EXPANSION ===
        # Use LLM to understand query semantically and generate variations
        # This works for ANY topic, not just predefined terms
        query_variations = expand_query_with_llm(question, self.generator)
        log_debug("Smart query expansion", original=question, variations=query_variations)
        
        # Multi-query search for better retrieval
        all_results = []
        seen_ids = set()
        
        expanded_top_k = settings.top_k * retrieval_multiplier
        
        # Search with all query variations (original + LLM-generated)
        for idx, query_variant in enumerate(query_variations):
            variant_results = self.index.search(query_variant, top_k=expanded_top_k)
            for r in variant_results:
                result_id = r.get('id') or r['text'][:100]
                if result_id not in seen_ids:
                    # Boost original query results slightly
                    if idx == 0:
                        r['score'] *= 1.1
                    all_results.append(r)
                    seen_ids.add(result_id)
        
        # 3. Search with original query (before normalization)
        if question != normalized_question:
            original_results = self.index.search(question, top_k=expanded_top_k)
            for r in original_results:
                result_id = r.get('id') or r['text'][:100]
                if result_id not in seen_ids:
                    all_results.append(r)
                    seen_ids.add(result_id)
        
        # 3. Extract key terms and search with them
        # Remove grammar particles and search with core terms
        from rag.transliterate import remove_grammar_particles
        core_query = remove_grammar_particles(normalized_question)
        if core_query != normalized_question:
            core_results = self.index.search(core_query, top_k=expanded_top_k)
            for r in core_results:
                result_id = r.get('id') or r['text'][:100]
                if result_id not in seen_ids:
                    all_results.append(r)
                    seen_ids.add(result_id)
        
        # Sort all results by score and take expanded top_k
        all_results.sort(key=lambda x: x['score'], reverse=True)
        retrieved = all_results[:expanded_top_k]
        
        # === HYBRID RERANKING (Semantic + Lexical) ===        
        # Extract query terms for lexical matching
        query_terms = set(normalized_question.lower().split())
        # Also extract terms from original question
        query_terms.update(question.lower().split())
        
        # Remove very short terms (noise)
        query_terms = {t for t in query_terms if len(t) > 2}        
        # Rerank each chunk with hybrid score
        for r in retrieved:
            # Safe text extraction with None check
            chunk_text = r.get('text', '') or ''
            chunk_text_lower = chunk_text.lower()
            chunk_terms = set(chunk_text_lower.split())
            
            # 1. Semantic score (already from embedding search)
            semantic_score = r.get('score', 0.0)
            
            # 2. Lexical score (keyword matching)
            # Count how many query terms appear in chunk
            matching_terms = query_terms & chunk_terms
            lexical_score = len(matching_terms) / len(query_terms) if query_terms else 0
            
            # 3. Exact phrase bonus
            exact_phrases_bonus = 0
            # Check if multi-word phrases from query appear exactly in chunk
            query_words = normalized_question.split()
            for i in range(len(query_words) - 1):
                bigram = f"{query_words[i]} {query_words[i+1]}"
                if bigram in chunk_text_lower:
                    exact_phrases_bonus += 0.05
            
            # 4. Title/metadata relevance bonus
            meta_bonus = 0
            meta = r.get('meta', {}) or {}
            title = (meta.get('title') or '').lower()
            service = (meta.get('service_name') or '').lower()
            ministry = (meta.get('ministry') or '').lower()
            
            # Check if query terms match title/service/ministry
            for term in query_terms:
                if term in title or term in service or term in ministry:
                    meta_bonus += 0.03
            
            # Combine scores with weights
            # Semantic: 60%, Lexical: 25%, Exact phrases: 10%, Metadata: 5%
            hybrid_score = (
                semantic_score * 0.60 +
                lexical_score * 0.25 +
                exact_phrases_bonus * 0.10 +
                meta_bonus * 0.05
            )
            
            # Store both scores
            r['semantic_score'] = semantic_score
            r['lexical_score'] = lexical_score
            r['hybrid_score'] = hybrid_score
            
            # Update main score with hybrid
            r['score'] = hybrid_score
        
        # Re-sort by hybrid score
        retrieved.sort(key=lambda x: x['hybrid_score'], reverse=True)
        
        # Show top 3 reranking results
        for i, r in enumerate(retrieved[:3], 1):
            sem = r.get('semantic_score', 0)
            lex = r.get('lexical_score', 0)
            hyb = r.get('hybrid_score', 0)
            title = r.get('meta', {}).get('title', 'Unknown')[:30]        
        # Apply recency boost: prioritize recent documents
        from datetime import datetime
        for r in retrieved:
            upload_date = r['meta'].get('upload_date', 'Unknown')
            if upload_date and upload_date != 'Unknown':
                try:
                    # Parse date and calculate recency boost
                    doc_date = datetime.strptime(upload_date, "%Y-%m-%d %H:%M:%S")
                    days_old = (datetime.now() - doc_date).days
                    
                    # Boost recent documents using config values
                    if days_old <= settings.recency_boost_days_high:
                        r['score'] *= settings.recency_boost_high
                        r['recency_boost'] = True
                    elif days_old <= settings.recency_boost_days_medium:
                        r['score'] *= settings.recency_boost_medium
                        r['recency_boost'] = True
                    else:
                        r['recency_boost'] = False
                except Exception:
                    # Failed to parse date, no boost applied
                    r['recency_boost'] = False
            else:
                r['recency_boost'] = False
        
        # Re-sort after recency boost
        all_results.sort(key=lambda x: x['score'], reverse=True)
        retrieved = all_results[:expanded_top_k]
        
        # Log top results before filtering
        log_debug("Top retrieval results", 
                  query=question[:50],
                  top_scores=[f"{r['score']:.3f}" for r in retrieved[:3]])
        
        # Filter by relevance threshold to avoid completely irrelevant chunks
        retrieved = [r for r in retrieved if r['score'] >= settings.relevance_threshold]
        
        log_debug("After threshold filtering",
                  threshold=settings.relevance_threshold,
                  remaining_count=len(retrieved))
        
        if not retrieved:
            # Detect if asking "who is" about a government position
            person_query_patterns = [
                'who is', 'who are', 
                'name of',
                'current'
            ]
            
            government_positions = [
                'president', 
                'prime minister',
                'minister',
                'speaker',
                'chief justice',
                'attorney general'
            ]
            
            q_lower = normalized_question.lower()
            is_person_query = any(pattern in q_lower for pattern in person_query_patterns)
            is_about_position = any(pos in q_lower for pos in government_positions)
            
            if is_person_query and is_about_position:                
                # Extract the position being asked about
                position_asked = "this position"
                for pos in government_positions:
                    if pos in q_lower:
                        position_asked = pos
                        break
                
                # Provide helpful clarification
                final_answer = (
                    f"📌 The current {position_asked}'s name/identity is not mentioned in the government documents.\n\n"
                    f"However, I have information about **the role, powers, and responsibilities of the {position_asked}**.\n\n"
                    f"If you would like to know about the {position_asked}'s:\n"
                    f"• Scope of work\n"
                    f"• Powers\n"
                    f"• Responsibilities\n"
                    f"• Appointment process\n\n"
                    f"Please feel free to ask! 😊"
                )
                return final_answer
            
            # Default "not found" response for other queries
            final_answer = "This information is not available in the documents."
            print(f"   {final_answer}")
            return final_answer
        
        # Show similarity scores and content for debugging
        for i, r in enumerate(retrieved, 1):
            print(f"\n   [{i}] Score: {r['score']:.4f} | Source: {r['meta'].get('title', 'Unknown')}")
                # Smart filtering for comprehensive queries
        if is_comprehensive:
            # Detect if asking about constitutional/fundamental topics
            constitutional_keywords = ['rights', 'constitution']
            is_constitutional = any(kw in question.lower() or kw in normalized_question.lower() for kw in constitutional_keywords)
            
            if is_constitutional:
                # Filter out press releases and keep only constitution/law documents
                constitution_chunks = [r for r in retrieved if r['meta'].get('type') in ['constitution', 'law', 'act']]
                
                # If we have enough constitution chunks, use only those
                if len(constitution_chunks) >= 12:
                    retrieved = constitution_chunks
        
        # Build context with chunk numbers for better clarity
        # Group chunks by document type for better organization
        constitution_chunks = []
        law_chunks = []
        other_chunks = []
        sources_lines = []
        seen_sources = set()
        
        for i, r in enumerate(retrieved, 1):
            meta = r.get("meta", {}) or {}
            
            # Clean chunk text to avoid safety filter triggers
            chunk_text = r.get('text', '') or ''
            cleaned_text = self._clean_chunk_for_llm(chunk_text)
            
            # Categorize chunks
            doc_type = meta.get('type', 'other') or 'other'
            
            # Build rich context with metadata
            meta_info = []
            if meta.get('title'):
                meta_info.append(f"Title: {meta['title']}")
            if meta.get('ministry') and meta['ministry'] != 'Unknown':
                meta_info.append(f"Ministry: {meta['ministry']}")
            if meta.get('service_name') and meta['service_name'] != 'Unknown':
                meta_info.append(f"Service: {meta['service_name']}")
            if meta.get('notice_id'):
                meta_info.append(f"Notice: {meta['notice_id']}")
            if meta.get('upload_date') and meta['upload_date'] != 'Unknown':
                meta_info.append(f"Date: {meta['upload_date']}")
            
            # Format chunk with rich metadata for better LLM understanding
            if meta_info:
                chunk_entry = f"[{i}] ({', '.join(meta_info)})\n{cleaned_text}"
            else:
                chunk_entry = f"[{i}] {cleaned_text}"
            
            if doc_type == 'constitution':
                constitution_chunks.append(chunk_entry)
            elif doc_type in ['law', 'act']:
                law_chunks.append(chunk_entry)
            else:
                other_chunks.append(chunk_entry)
            
            # Deduplicate sources and try to extract page info from chunk
            source_key = f"{meta.get('title') or 'Unknown'}"
            title = meta.get('title') or 'Unknown'
            
            # Skip test/dummy documents and unknown titles
            if any(skip in title.lower() for skip in ['test-', 'dummy', 'unknown', 'untitled']):
                continue
            
            # Clean up document name - remove file extensions and clean formatting
            clean_title = title.replace('_', ' ').replace('-', ' ')
            # Remove common suffixes
            for suffix in ['.pdf', '.txt', '.md', 'www.', '.gov', '.np']:
                clean_title = clean_title.replace(suffix, '')
            # Simplify long government document names
            if 'Constitution' in clean_title and 'Nepal' in clean_title:
                clean_title = 'Constitution of Nepal 2072'
            
            # Try to find page reference in chunk text
            page_info = ""
            import re as regex_module
            page_match = regex_module.search(r'(?:Page|p\.?)\s*(\d+)', cleaned_text, regex_module.IGNORECASE)
            if page_match:
                page_info = f" (Page {page_match.group(1)})"
            
            if source_key not in seen_sources:
                seen_sources.add(source_key)
                
                # Format source line with complete metadata including date
                source_parts = [f"📄 {clean_title}{page_info}"]
                
                ministry = meta.get('ministry', '')
                service = meta.get('service_name', '')
                upload_date = meta.get('upload_date', '')
                
                if ministry and ministry != 'Unknown' and ministry.strip():
                    source_parts.append(ministry)
                if service and service != 'Unknown' and service.strip():
                    source_parts.append(f"Service: {service}")
                if upload_date and upload_date != 'Unknown':
                    # Show both date and time
                    source_parts.append(f"📅 {upload_date}")
                
                source_line = " • ".join(source_parts)
                sources_lines.append(source_line)
        
        # Build organized context with intelligent grouping for multi-document understanding
        context_sections = []
        
        # Add metadata summary to help LLM understand document relationships
        doc_summary = []
        doc_types_present = set()
        ministries_present = set()
        date_range = []
        
        for r in retrieved:
            meta = r.get("meta", {}) or {}
            doc_type = meta.get('type', 'other') or 'other'
            ministry = meta.get('ministry', '') or ''
            upload_date = meta.get('upload_date', '') or ''
            
            if doc_type:
                doc_types_present.add(doc_type)
            if ministry and ministry != 'Unknown':
                ministries_present.add(ministry)
            if upload_date and upload_date != 'Unknown':
                date_range.append(upload_date)
        
        # Create context overview to help LLM connect concepts
        overview = "📋 **Document Summary:** "
        
        overview_parts = []
        if doc_types_present:
            types_str = ', '.join(doc_types_present)
            overview_parts.append(f"Type: {types_str}")
        if ministries_present:
            ministries_str = ', '.join(list(ministries_present)[:3])  # Show max 3
            overview_parts.append(f"Ministry: {ministries_str}")
        if date_range:
            dates_sorted = sorted(date_range, reverse=True)
            if len(dates_sorted) > 1:
                overview_parts.append(f"Date: {dates_sorted[0]} to {dates_sorted[-1]}")
            else:
                overview_parts.append(f"Date: {dates_sorted[0]}")
        
        if overview_parts:
            overview += " | ".join(overview_parts)
            context_sections.append(overview)
        
        # Organize chunks by type with clear separators
        if constitution_chunks:
            section = f"📜 **From Constitution** ({len(constitution_chunks)} sections):\n" + "\n\n".join(constitution_chunks)
            context_sections.append(section)
        if law_chunks:
            section = f"⚖️ **From Laws/Acts** ({len(law_chunks)} sections):\n" + "\n\n".join(law_chunks)
            context_sections.append(section)
        if other_chunks:
            section = f"📄 **From Other Government Documents** ({len(other_chunks)} sections):\n" + "\n\n".join(other_chunks)
            context_sections.append(section)
        
        # Add cross-reference note if multiple document types present
        if len(doc_types_present) > 1:
            context_sections.append(
                "\n💡 **Note:** There are different types of documents above. "
                "If there are multiple sources on a topic, combine all their information in one place."
            )
        
        context_text = "\n\n".join(context_sections)
        sources_text = "\n".join(sources_lines)

        # Build prompt with enhanced reasoning instructions
        system_message = (
            "You are an expert AI assistant for document analysis with deep reasoning capabilities.\n\n"
            "🧠 **Your thinking process (don't show this, but follow it):**\n"
            "1. What is being asked? (Identify main concepts, entities, and context)\n"
            "2. What information is in which document? (Check relevance of each chunk)\n"
            "3. What relationships exist between different documents? (Connect info from different sources)\n"
            "4. Which information should be prioritized? (Check dates - newer > older)\n"
            "5. What information is incomplete or missing? (State clearly if present)\n\n"
            "✅ **Your tasks:**\n"
            "• Extract accurate information from the provided documents\n"
            "• Provide complete and comprehensive answers (not incomplete)\n"
            "• Include all relevant points\n"
            "• Connect information from different sources\n"
            "• Present clearly and organized\n"
            "• Answer based ONLY on the given documents (no guessing)\n"
            "• Pay attention to document context (ministry, service, ID, date)\n"
            "• Prioritize recent documents - use new information if conflicting\n\n"
            "⚠️ **If information is incomplete:**\n"
            "• What information exists - provide that first\n"
            "• What information is missing - state clearly\n"
            "• Don't guess - only state what's in the documents"
        )
        
        # Adjust instructions based on query type
        if wants_brief_answer:
            task_instruction = (
                "**This is a brief answer request - provide a concise response:**\n\n"
                "Please:\n"
                "• Mention only the main points (3-5 sentences)\n"
                "• Don't provide detailed descriptions\n"
                "• Use simple and clear language\n"
                "• Don't expand with long lists\n\n"
                "Provide a concise answer in English based on the above documents."
            )
        elif is_comprehensive:
            task_instruction = (
                "**This is a comprehensive question - all information needed:**\n\n"
                "Please from all the above documents:\n"
                "• Identify each relevant point\n"
                "• List all points in an organized manner\n"
                "• Don't miss any points\n"
                "• Provide brief description for each point\n\n"
                "Example format:\n"
                "1. First right: (description)\n"
                "2. Second right: (description)\n"
                "3. Third right: (description)\n"
                "... and so on\n\n"
                "Note: Provide a COMPLETE LIST, not just 1-2 examples!"
            )
        else:
            task_instruction = (
                "Provide an accurate and detailed answer in English based on the above documents."
            )

        # Structured prompt
        prompt = (
            f"{system_message}\n\n"
            f"{'='*60}\n"
            f"📚 Available Documents:\n\n"
            f"{context_text}\n\n"
            f"{'='*60}\n\n"
            f"❓ Question: {llm_question}\n\n"
            f"{task_instruction}\n\n"
            f"💡 Answer (English, complete and detailed):"
        )
        
        print(f"\n{'='*80}")
        answer_body = self.generator.generate(prompt)        
        # Clean up answer - remove instruction echoes and nonsense
        answer_body = answer_body.strip()
        
        # Check if output is in romanized form (has Latin diacritics)
        romanized_chars = ['ā', 'ī', 'ū', 'ṛ', 'ṃ', 'ṅ', 'ñ', 'ṭ', 'ḍ', 'ṇ', 'ś', 'ṣ']
        if any(char in answer_body for char in romanized_chars):
            answer_body = "This information is not available in the documents."
            final_answer = answer_body  # No sources for error case
            print(f"   {answer_body}")
            return final_answer
        
        answer_body = answer_body.strip()
        
        # Remove instruction echoes and meta-commentary
        # (English-only, simplified cleaning)
        answer_body = answer_body.strip()
        
        # Basic cleanup: remove question echoes
        sentences = [s.strip() for s in answer_body.split('\n') if s.strip()]
        question_lower = normalized_question.lower()
        question_words = set(question_lower.split())
        
        clean_sentences = []
        for i, sent in enumerate(sentences):
            if not sent:
                continue
            
            sent_lower = sent.lower()
            sent_words = set(sent_lower.split())
            
            # If first sentence and has >70% question word overlap, skip it
            if i == 0 and len(question_words) > 0:
                overlap = len(question_words & sent_words)
                overlap_ratio = overlap / len(question_words)
                if overlap_ratio > 0.7:
                    continue
            
            clean_sentences.append(sent)
        
        if clean_sentences:
            answer_body = '\n'.join(clean_sentences)
        
        answer_body = answer_body.strip()
        
        # Basic validation (English-only system)
        answer_lower = answer_body.lower()
        
        # === ANSWER VALIDATION AGAINST SOURCES ===        
        # Extract key claims from the answer (sentences with specific facts)
        answer_sentences = [s.strip() for s in answer_body.split('.') if len(s.strip()) > 10]
        
        # Check if answer contains information that's actually in the chunks
        validation_passed = True
        unsupported_claims = []
        
        # Combine all chunk texts for validation
        all_chunk_text = ' '.join([r['text'].lower() for r in retrieved])
        
        # Look for specific numeric values or dates in answer
        import re as regex_validation
        numbers_in_answer = regex_validation.findall(r'\d+', answer_body)
        
        if numbers_in_answer:
            numbers_found_in_chunks = 0
            for num in numbers_in_answer[:5]:  # Check first 5 numbers
                if num in all_chunk_text:
                    numbers_found_in_chunks += 1
            
            # If answer has specific numbers, at least some should appear in chunks
            if len(numbers_in_answer) >= 3 and numbers_found_in_chunks == 0:
                print(f"   ⚠️  WARNING: Answer contains numbers not found in chunks")
                validation_passed = False
        
        # Check for key terms mentioned in answer
        key_terms_in_answer = []
        for sentence in answer_sentences[:3]:  # Check first 3 sentences
            # Extract potential key terms (words longer than 4 chars)
            words = sentence.split()
            for word in words:
                cleaned_word = word.strip('.,;:()[]"\'')
                # Check if it's a word of reasonable length
                if len(cleaned_word) > 4:
                    key_terms_in_answer.append(cleaned_word.lower())
        
        # Verify at least 60% of key terms appear in chunks
        if key_terms_in_answer:
            terms_found = sum(1 for term in key_terms_in_answer if term in all_chunk_text)
            coverage = terms_found / len(key_terms_in_answer) if key_terms_in_answer else 0            
            if coverage < 0.6:
                print(f"   ⚠️  WARNING: Low coverage - answer may not be well-supported")
                validation_passed = False
        
        # Final validation result
        if validation_passed:
            print(f"   ✅ Answer validation PASSED - content is supported by sources")
        else:
            print(f"   ⚠️  Answer validation FAILED - some claims may not be well-supported")
            print(f"   💡 Consider: Answer might be hallucinated or inferred")
        
            final_answer = answer_body  # No sources for error case            print(f"   {answer_body}")            return final_answer
        
        # Remove lines that are just repetitive nonsense
        lines = answer_body.split('\n')
        clean_lines = []
        prev_line = ""
        for line in lines:
            line = line.strip()
            if not line:
                continue
            # Skip duplicate lines
            if line == prev_line:
                continue
            # Skip lines with excessive repetition of same words
            words = line.split()
            if len(words) > 3 and len(set(words)) / len(words) < 0.4:  # Too repetitive
                continue
            clean_lines.append(line)
            prev_line = line
        
        answer_body = '\n\n'.join(clean_lines)
        
        if not answer_body:
            answer_body = "This information is not available in the documents."
        
        # Detect if LLM says "no information available" AND provides nothing else
        # Only suppress sources if the answer is SHORT and says "not found"
        answer_lower = answer_body.lower()
        
        # Check if answer is very short (likely just "no info" message)
        is_short_answer = len(answer_body) < 150
        
        # Check if it's genuinely a "no info" response
        no_info_indicators = [
            'information is not available',
            'not available in the documents',
            'no information available'
        ]
        
        # Only mark as "no info" if short AND has exact phrase
        llm_says_no_info = is_short_answer and any(phrase in answer_lower for phrase in no_info_indicators)
        
        # Check if LLM response indicates "person identity not available"
        # This happens when user asks "who is president?" but docs only have role info
        person_not_found_patterns = [
            'who.*?is.*?not.*?mentioned',
            'name.*?not.*?mentioned',
            'identity.*?not.*?available'
        ]
        
        llm_says_person_not_found = any(re.search(pattern, answer_lower) for pattern in person_not_found_patterns)
        
        if llm_says_person_not_found:
            # Check if original question was asking "who is"
            person_query_patterns = [
                'who is', 'who are', 
                'name of', 'current'
            ]
            
            government_positions = [
                'president', 
                'prime minister',
                'minister',
                'speaker',
                'chief justice'
            ]
            
            q_lower = normalized_question.lower()
            is_person_query = any(pattern in q_lower for pattern in person_query_patterns)
            is_about_position = any(pos in q_lower for pos in government_positions)
            
            if is_person_query and is_about_position:
                print(f"\n✨ DETECTED: LLM says person name not found + user asked 'who is' query")
                print(f"   Adding helpful guidance...")
                
                # Extract position being asked about
                position_asked = "this position"
                for pos in government_positions:
                    if pos in q_lower:
                        position_asked = pos
                        break
                
                # Enhance answer with helpful guidance
                enhanced_answer = (
                    f"{answer_body}\n\n"
                    f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
                    f"💡 **Help:** The current {position_asked}'s name/identity is not mentioned in the government documents.\n\n"
                    f"However, I have detailed information about **the role, powers, and responsibilities of the {position_asked}**!\n\n"
                    f"If you would like to know about:\n"
                    f"• {position_asked}'s scope of work\n"
                    f"• Powers and authorities\n"
                    f"• Responsibilities\n"
                    f"• Appointment process\n\n"
                    f"Please feel free to ask! Example: \"What are the powers of the {position_asked}?\" 😊"
                )
                answer_body = enhanced_answer
        
        # Only add sources if:
        # 1. Sources exist (non-empty list)
        # 2. LLM provided real content (not just "no info")
        # 3. Answer is substantial (has meaningful content)
        should_show_sources = (
            sources_lines and 
            len(sources_lines) > 0 and 
            not llm_says_no_info and
            len(answer_body.strip()) > 50  # Ensure answer has real content
        )
        
        if should_show_sources:
            final_answer = f"{answer_body}\n\n📚 **Reference Sources:**\n{sources_text}"
        else:
            final_answer = answer_body
        
        print(f"\n✨ CLEANED ANSWER:")
        print(f"   Sources shown: {'Yes' if should_show_sources else 'No'} ({len(sources_lines)} available)")
        
        return final_answer
