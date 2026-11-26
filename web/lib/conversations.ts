"use client";

import { createClient, isSupabaseConfigured } from "./supabase/client";
import type { ChatMessage, Locale } from "./types";

export interface StoredSession {
  id: string;
  title: string;
  locale: Locale;
  updatedAt: string;
  messages: ChatMessage[];
}

const LOCAL_KEY = "sarkar.sessions.v1";

function readLocal(): StoredSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(sessions: StoredSession[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(sessions.slice(0, 40)));
  } catch {
    // Quota or private mode — sessions simply do not persist.
  }
}

async function currentUserId(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function listSessions(): Promise<StoredSession[]> {
  const userId = await currentUserId();
  if (userId) {
    const supabase = createClient();
    if (supabase) {
      const { data } = await supabase
        .from("conversations")
        .select("id,title,language,updated_at,messages(id,role,content,sources,quality_score,latency_ms,created_at)")
        .order("updated_at", { ascending: false })
        .limit(40);
      if (data) {
        return (
          data as Array<{
            id: string;
            title: string | null;
            language: string;
            updated_at: string;
            messages: Array<{
              id: string;
              role: string;
              content: string;
              sources: ChatMessage["sources"];
              quality_score: number | null;
              latency_ms: number | null;
              created_at: string;
            }>;
          }>
        ).map((row) => ({
          id: row.id,
          title: row.title ?? "Untitled session",
          locale: (row.language === "ne" ? "ne" : "en") as Locale,
          updatedAt: row.updated_at,
          messages: (row.messages ?? [])
            .filter((m) => m.role !== "system")
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
            .map((m) => ({
              id: m.id,
              role: m.role === "assistant" ? "assistant" : "user",
              content: m.content,
              sources: m.sources ?? [],
              qualityScore: m.quality_score,
              latencyMs: m.latency_ms,
              createdAt: m.created_at,
            })),
        }));
      }
    }
  }
  return readLocal().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveSession(session: StoredSession): Promise<void> {
  const local = readLocal().filter((item) => item.id !== session.id);
  writeLocal([session, ...local]);

  const userId = await currentUserId();
  const supabase = createClient();
  if (!userId || !supabase) return;

  await supabase.from("conversations").upsert({
    id: session.id,
    user_id: userId,
    title: session.title.slice(0, 160),
    language: session.locale,
    updated_at: session.updatedAt,
  });

  const rows = session.messages
    .filter((message) => message.id && !message.pending && !message.error)
    .map((message) => ({
      id: message.id,
      conversation_id: session.id,
      role: message.role,
      content: message.content,
      sources: message.sources ?? [],
      quality_score: message.qualityScore ?? null,
      latency_ms: message.latencyMs ?? null,
    }));

  if (rows.length) {
    await supabase.from("messages").upsert(rows, { onConflict: "id" });
  }
}

export async function deleteSession(id: string): Promise<void> {
  writeLocal(readLocal().filter((item) => item.id !== id));
  const userId = await currentUserId();
  const supabase = createClient();
  if (!userId || !supabase) return;
  await supabase.from("conversations").delete().eq("id", id);
}

export async function clearSessions(): Promise<void> {
  writeLocal([]);
}
