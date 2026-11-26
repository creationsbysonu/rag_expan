"use client";

/**
 * A visitor's own model key, kept in sessionStorage for the current tab only.
 *
 * It is never sent to our database and never cached server-side: the chat
 * function uses it for the single request and forgets it.
 */

export type KeyProvider = "cloudflare" | "gemini";

export interface KeyChoice {
  key: string;
  provider: KeyProvider;
}

const STORAGE_KEY = "sarkar.llm-key";

export function loadKey(): KeyChoice | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<KeyChoice>;
    if (!parsed.key) return null;
    return {
      key: String(parsed.key),
      provider: parsed.provider === "gemini" ? "gemini" : "cloudflare",
    };
  } catch {
    return null;
  }
}

export function storeKey(choice: KeyChoice | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!choice) window.sessionStorage.removeItem(STORAGE_KEY);
    else window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(choice));
  } catch {
    // Private browsing can refuse storage; the key still works for this send.
  }
}
