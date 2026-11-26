const REFUSALS = [
  "not available",
  "no information",
  "could not find",
  "cannot find",
  "does not contain",
  "unable to answer",
  "जानकारी उपलब्ध छैन",
  "भेटिएन",
  "उपलब्ध छैन",
];

function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[\u0964\u0965]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3);
}

/**
 * Heuristic grounding score (0–100).
 * Measures how much of the answer's vocabulary is supported by retrieved
 * passages, with penalties for refusals and bonuses for explicit citations.
 * Deterministic and cheap — a signal, not a certificate.
 */
export function scoreAnswer(
  answer: string,
  passages: string[],
  citationMarkers: number,
): number {
  const trimmed = answer.trim();
  if (trimmed.length < 24) return 30;

  const lower = trimmed.toLowerCase();
  if (REFUSALS.some((phrase) => lower.includes(phrase))) return 24;

  const sourceTokens = new Set(tokenise(passages.join(" ")));
  const answerTokens = [...new Set(tokenise(trimmed))];
  if (answerTokens.length === 0) return 35;

  let supported = 0;
  for (const token of answerTokens) {
    if (sourceTokens.has(token)) supported += 1;
  }

  const overlap = supported / answerTokens.length;
  let score = 35 + overlap * 60;

  if (citationMarkers > 0) score += 5;
  if (trimmed.length > 2200) score -= 4;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function detectLanguage(text: string): "ne" | "en" {
  if (/[\u0900-\u097F]/.test(text)) return "ne";
  return "en";
}

export function truncateContext(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const boundary = Math.max(cut.lastIndexOf("\n\n"), cut.lastIndexOf(". "));
  return boundary > limit * 0.5 ? cut.slice(0, boundary) : cut;
}
