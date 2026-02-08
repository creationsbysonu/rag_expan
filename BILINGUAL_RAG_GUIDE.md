# 🌐 Bilingual RAG Chatbot Guide (Nepali + English)

## ✅ Current Status - What's Already Working

### 1. **Answer Language Selection** ✓
- ✅ UI dropdown to select answer language (English/Nepali)
- ✅ Generates answers in the selected language
- ✅ Error messages match selected language
- ✅ Vague query responses in correct language

### 2. **Multilingual Embeddings** ✓
- ✅ Using `intfloat/multilingual-e5-base`
- ✅ Supports 100+ languages including Nepali and English
- ✅ Same embedding space for both languages

### 3. **Query Processing** ✓
- ✅ Romanized Nepali detection (e.g., "ke training haru cha?")
- ✅ Devanagari script support (e.g., "के तालिम हरु छ?")
- ✅ English query support
- ✅ Query normalization and transliteration

### 4. **LLM Generation** ✓
- ✅ Google Gemini with language parameter
- ✅ System prompts in both languages
- ✅ Context-aware responses

---

## 🎯 Features You Need to Focus On

### **1. Document Ingestion (Mixed Language Support)**

#### Current State:
- Documents can be in English or Nepali
- OCR supports both scripts

#### What to Consider:
```python
# When uploading documents:
# ✓ System already handles: PDF, images, text files
# ✓ OCR can extract: Devanagari & Latin text
# ✓ Chunking works for: Both languages

# ⚠️ Be aware of:
# - Mixed language documents (English + Nepali)
# - Proper sentence boundaries for both scripts
# - Metadata should indicate document language
```

#### Recommendations:
1. **Add language metadata during upload**:
```python
# In rag/ingest.py - add document language detection
def detect_document_language(text: str) -> str:
    """Detect primary language of document"""
    devanagari_chars = sum(1 for c in text if '\u0900' <= c <= '\u097F')
    latin_chars = sum(1 for c in text if c.isalpha() and ord(c) < 128)
    
    if devanagari_chars > latin_chars:
        return "ne"
    elif latin_chars > devanagari_chars:
        return "en"
    else:
        return "mixed"
```

2. **Store language in metadata**:
```python
meta = {
    "notice_id": notice_id,
    "title": title,
    "page": page_num,
    "language": detect_document_language(chunk),  # Add this
    "date": extracted_date
}
```

### **2. Search & Retrieval (Cross-Language)**

#### Current State:
- ✅ Multilingual embeddings work across languages
- ✅ Can search English query → Find Nepali docs
- ✅ Can search Nepali query → Find English docs

#### What to Consider:
```python
# Query: "What trainings are available?"
# Can retrieve: 
# - English docs about trainings
# - Nepali docs: "तालिम कार्यक्रमहरू"
# - Mixed language docs

# This works because multilingual-e5-base creates
# semantic embeddings in shared space
```

#### Recommendations:
1. **Boost same-language results** (optional):
```python
# In rag/index.py - add language matching bonus
def search(self, query: str, top_k: int = 5, query_language: str = None):
    """Enhanced search with language preference"""
    results = self._base_search(query, top_k * 2)  # Get more candidates
    
    if query_language:
        # Boost documents in same language
        for r in results:
            doc_lang = r.get('meta', {}).get('language')
            if doc_lang == query_language:
                r['score'] *= 1.1  # 10% boost
    
    # Re-sort and return top_k
    results.sort(key=lambda x: x['score'], reverse=True)
    return results[:top_k]
```

### **3. Answer Generation (Bilingual Context)**

#### Current State:
- ✅ LLM receives language parameter
- ✅ Generates in requested language
- ✅ Can handle mixed language contexts

#### What to Consider:
```python
# Scenario: User selects English, but context has Nepali docs
# System should:
# 1. Retrieve relevant docs (Nepali or English)
# 2. Pass context to LLM
# 3. LLM translates/summarizes in English

# Example:
Context (Nepali): "काठमाडौं महानगरपालिकाले सफाइ तालिम गर्दैछ।"
Query (English): "What training is happening?"
Answer (English): "Kathmandu Metropolitan City is conducting cleanliness training."
```

#### Recommendations:
1. **Add translation hints in system prompt** (already done):
```python
# Your current system prompt already handles this well:
# "If context is in Nepali but answer needed in English, translate appropriately"
```

2. **Handle code-switching** (Nepali-English mix):
```python
# System already handles this through Gemini's multilingual capability
```

### **4. Query Understanding (Romanized Nepali)**

#### Current State:
- ✅ Detection: `is_romanized_nepali()` in transliterate.py
- ✅ Conversion: Can convert to Devanagari
- ✅ Patterns: Recognizes common Nepali words in Latin script

#### What to Consider:
```python
# Users might type:
# "ke training haru cha?" → Should understand as Nepali
# "kun dastabej ma cha?" → Should understand as Nepali
# "What trainings available?" → Should understand as English
```

#### Recommendations:
1. **Use language detector before embeddings**:
```python
from rag.language_detector import detect_language

# In pipeline.py before search:
query_lang = detect_language(question)
# Then use for retrieval boosting
```

2. **Normalize romanized queries** (already implemented):
```python
# Your normalize_query() already handles this
```

### **5. UI/UX Considerations**

#### Current Features:
- ✅ Language selector for answers
- ✅ Can type in any language/script
- ✅ Copy, edit, translate buttons

#### Recommendations:
1. **Show document language in sources**:
```javascript
// In static/app.js - when showing sources:
if (source.language) {
    sourceDiv.innerHTML += `<span class="lang-badge">${source.language}</span>`;
}
```

2. **Query language indicator** (optional):
```javascript
// Show detected query language
function showQueryLanguage(detectedLang) {
    const indicator = document.createElement('div');
    indicator.innerHTML = `🔍 Query detected as: ${detectedLang === 'en' ? 'English' : 'Nepali'}`;
    // Show briefly
}
```

---

## 🚀 Best Practices for Bilingual RAG

### **1. Embedding Strategy**
```python
# ✅ GOOD: Use multilingual model (current approach)
embedder = E5Embedding("intfloat/multilingual-e5-base")

# ❌ AVOID: Separate embeddings for each language
# This creates disconnected semantic spaces
```

### **2. Chunking Strategy**
```python
# ✅ GOOD: Respect language-specific sentence boundaries
# Nepali: Use । (danda) and ।। (double danda)
# English: Use . ! ?

# Your current implementation already handles this in ingest.py
```

### **3. Prompt Engineering**
```python
# ✅ GOOD: Clear language instructions (already implemented)
if language == "en":
    system_prompt = "Answer in English. If context is in Nepali, translate..."
else:
    system_prompt = "उत्तर नेपालीमा दिनुहोस्। यदि context अंग्रेजीमा छ भने अनुवाद..."

# ✅ GOOD: Provide examples in both languages
```

### **4. Fallback Handling**
```python
# When no relevant docs found:
if language == "en":
    return "No relevant information found in the documents."
else:
    return "दस्तावेजहरूमा सान्दर्भिक जानकारी फेला परेन।"
```

---

## 📊 Testing Checklist

### **Test Scenarios:**

#### ✅ 1. Same Language (En→En)
- Query: "What trainings are available?"
- Docs: English documents
- Expected: English answer from English docs

#### ✅ 2. Same Language (Ne→Ne)  
- Query: "के तालिमहरू उपलब्ध छन्?"
- Docs: Nepali documents
- Expected: Nepali answer from Nepali docs

#### ✅ 3. Cross Language (En→Ne)
- Query: "What trainings are available?"
- Docs: Nepali documents
- Answer Language: English
- Expected: English answer translated from Nepali docs

#### ✅ 4. Cross Language (Ne→En)
- Query: "के तालिमहरू उपलब्ध छन्?"
- Docs: English documents  
- Answer Language: Nepali
- Expected: Nepali answer translated from English docs

#### ✅ 5. Romanized Nepali
- Query: "ke training haru cha?"
- Docs: Any language
- Expected: Understand as Nepali query

#### ✅ 6. Mixed Documents
- Query: Any language
- Docs: Mix of English and Nepali
- Expected: Pull relevant info from both

---

## 🔧 Quick Fixes & Enhancements

### **Enhancement 1: Add Query Language Display**
```python
# In app_chat.py
from rag.language_detector import detect_language

async def generate():
    detected_lang = detect_language(question)
    log_info(f"Query language detected: {detected_lang}")
    
    # Optional: Return to frontend
    yield json.dumps({
        "type": "metadata", 
        "detected_language": detected_lang
    }) + "\n"
```

### **Enhancement 2: Language-Aware Error Messages**
All error messages are now language-aware (✅ already implemented)

### **Enhancement 3: Document Language Tagging**
```python
# Add to rag/ingest.py
def ingest_with_language_detection(file_path):
    # ... existing code ...
    
    # Detect language per chunk
    for chunk in chunks:
        lang = detect_document_language(chunk)
        metadata = {
            "source": file_path,
            "language": lang,  # Add this
            # ... other metadata ...
        }
```

---

## 🎯 Summary: What Makes Your RAG Bilingual

### **Already Working** ✅
1. Multilingual embeddings (E5)
2. Language selector for answers
3. Romanized Nepali support
4. Gemini LLM with language parameter
5. Error messages in both languages

### **To Enhance** 🔨
1. Document language metadata (optional but recommended)
2. Same-language result boosting (optional)
3. Query language display (nice to have)
4. Language badges in UI (nice to have)

### **Core Principle** 💡
**Your RAG is bilingual because:**
- **Semantic understanding** transcends language (multilingual embeddings)
- **Generation** adapts to user preference (language parameter)
- **Context** can be mixed (LLM handles translation)

---

## 📝 Next Steps

1. ✅ **Test current functionality** - Try queries in both languages
2. ⚠️ **Add document language metadata** - For better filtering (optional)
3. 💡 **Monitor performance** - Check if cross-language retrieval works well
4. 🚀 **Optimize prompts** - Refine based on user feedback

Your system is already well-designed for bilingual operation! The multilingual-e5-base model handles the heavy lifting of cross-language semantic understanding.
