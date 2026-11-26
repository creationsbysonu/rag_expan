import type { Locale } from "./types";

/**
 * Interface copy. Nepali strings are intentionally informal-government register,
 * not machine-literal translations.
 */
export const copy = {
  en: {
    langLabel: "EN",
    askPlaceholder: "Ask about a notice, ministry, service or procedure…",
    newSession: "New session",
    sessions: "Sessions",
    noSessions: "No sessions yet",
    evidence: "Evidence",
    noSources: "Sources appear here once an answer is grounded",
    quality: "Grounding",
    latency: "Latency",
    chunks: "passages",
    send: "Send",
    stop: "Stop",
    thinking: "Retrieving from the corpus",
    retrievedFrom: "Retrieved from",
    openSource: "Open source record",
    copyAnswer: "Copy answer",
    regenerate: "Ask again",
    emptyTitle: "Start with a question",
    emptyBody:
      "Answers are drawn only from the indexed government record. Every claim arrives with its source passages.",
    suggestions: [
      "What does the 2072 constitution say about fundamental rights?",
      "Which ministry handles citizenship certificates?",
      "Summarise the process for renewing a passport.",
      "म नागरिकता प्रमाणपत्र कसरी बनाउने?",
    ],
    disclaimer:
      "Prototype for research. Always verify against the original gazette or notice before acting.",
    rateLimited: "Too many requests — wait a moment.",
    errorGeneric: "The corpus could not be reached. Try again.",
    feedbackThanks: "Feedback recorded",
    ministryFilter: "Ministry",
    allMinistries: "All ministries",
    localMode: "Local mode",
    supabaseMode: "Supabase live",
  },
  ne: {
    langLabel: "ने",
    askPlaceholder: "सूचना, मन्त्रालय, सेवा वा प्रक्रियाबारे सोध्नुहोस्…",
    newSession: "नयाँ सत्र",
    sessions: "सत्रहरू",
    noSessions: "अझै कुनै सत्र छैन",
    evidence: "प्रमाण",
    noSources: "उत्तर स्रोतसहित आएपछि यहाँ देखिनेछ",
    quality: "आधार",
    latency: "समय",
    chunks: "अंश",
    send: "पठाउनु",
    stop: "रोक्नु",
    thinking: "कोषबाट खोज्दै",
    retrievedFrom: "स्रोत",
    openSource: "मूल सूचना खोल्नुहोस्",
    copyAnswer: "उत्तर प्रतिलिपि",
    regenerate: "फेरि सोध्नु",
    emptyTitle: "प्रश्नबाट सुरु गर्नुहोस्",
    emptyBody:
      "उत्तरहरू अनुक्रमणिकामा रहेका सरकारी कागजातबाट मात्र तयार हुन्छन्। प्रत्येक दाबीको स्रोत देखाइन्छ।",
    suggestions: [
      "२०७२ को संविधानमा मौलिक हकबारे के भनिएको छ?",
      "नागरिकता प्रमाणपत्र कुन मन्त्रालयले हेर्छ?",
      "राहदानी नवीकरणको प्रक्रिया संक्षेपमा बताउनुहोस्।",
      "How do I register a new business?",
    ],
    disclaimer:
      "अनुसन्धानका लागि प्रारूप। कार्य गर्नुअघि मूल राजपत्र वा सूचना रुजु गर्नुहोस्।",
    rateLimited: "धेरै अनुरोध भए — केही समय पर्खनुहोस्।",
    errorGeneric: "कोषसँग जडान हुन सकेन। फेरि प्रयास गर्नुहोस्।",
    feedbackThanks: "प्रतिक्रिया सुरक्षित भयो",
    ministryFilter: "मन्त्रालय",
    allMinistries: "सबै मन्त्रालय",
    localMode: "स्थानीय मोड",
    supabaseMode: "सुपाबेस",
  },
} as const;

export type Copy = (typeof copy)["en"];

export function t(locale: Locale): Copy {
  return copy[locale] as Copy;
}
