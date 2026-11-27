"use client";

import { createClient, isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase/client";
import type {
  CorpusStats,
  DashboardStats,
  DocumentRow,
  Locale,
  SourceRef,
  StreamEvent,
} from "./types";

const LOCAL_API =
  process.env.NEXT_PUBLIC_RAG_API_URL ||
  (process.env.NODE_ENV === "development" ? "http://localhost:8001" : "");

export type BackendMode = "supabase" | "local";

export function backendMode(): BackendMode {
  return isSupabaseConfigured ? "supabase" : "local";
}

export function backendLabel(): string {
  return backendMode() === "supabase" ? "Supabase Edge" : "Local FastAPI";
}

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!isSupabaseConfigured) return headers;
  const supabase = createClient();
  const {
    data: { session },
  } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
  if (session) headers.Authorization = `Bearer ${session.access_token}`;
  else headers.apikey = SUPABASE_ANON_KEY;
  return headers;
}

/** Error carrying the backend's machine-readable reason (e.g. quota_exhausted). */
export class ApiError extends Error {
  code?: string;
  action?: string;

  constructor(message: string, code?: string, action?: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.action = action;
  }
}

interface StreamChatArgs {
  question: string;
  sessionId: string;
  locale: Locale;
  ministry?: string | null;
  /** Visitor's own key; sent per request and never persisted server-side. */
  apiKey?: string;
  keyProvider?: "cloudflare" | "gemini";
  onEvent: (event: StreamEvent) => void;
  signal?: AbortSignal;
}

/**
 * Streams an answer from whichever backend is configured.
 * Both backends are normalised into StreamEvent objects.
 */
export async function streamChat({
  question,
  sessionId,
  locale,
  ministry,
  apiKey,
  keyProvider,
  onEvent,
  signal,
}: StreamChatArgs): Promise<void> {
  const useSupabase = isSupabaseConfigured;
  const endpoint = useSupabase
    ? `${SUPABASE_URL}/functions/v1/chat`
    : `${LOCAL_API.replace(/\/$/, "")}/chat/stream`;

  const headers = await authHeaders();
  if (apiKey) {
    headers["x-llm-key"] = apiKey;
    if (keyProvider) headers["x-llm-provider"] = keyProvider;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify({
      question,
      query: question,
      session_id: sessionId,
      language: locale,
      ministry: ministry ?? null,
      top_k: 6,
    }),
  });

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "");

    // The backend distinguishes a short rate limit from an exhausted embedding
    // quota; prefer its wording so "wait a minute" is never shown for a limit
    // that lasts hours.
    let serverMessage = "";
    let code: string | undefined;
    let action: string | undefined;
    try {
      const parsed = JSON.parse(detail) as { message?: string; code?: string; action?: string };
      serverMessage = String(parsed.message ?? "");
      code = parsed.code;
      action = parsed.action;
    } catch {
      serverMessage = "";
    }
    if (serverMessage) throw new ApiError(serverMessage, code, action);

    throw new Error(
      response.status === 429
        ? "Rate limit reached. Wait a minute and try again."
        : detail.slice(0, 300) || `Request failed (${response.status})`,
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE frames end with a blank line; the local FastAPI backend uses NDJSON.
    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      for (const line of frame.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(":") || trimmed.startsWith("event:")) continue;
        const payload = trimmed.startsWith("data:") ? trimmed.slice(5).trim() : trimmed;
        if (!payload || payload === "[DONE]") continue;
        try {
          const parsed = JSON.parse(payload) as Record<string, unknown>;
          const normalised = normaliseEvent(parsed);
          if (normalised) onEvent(normalised);
        } catch {
          // Ignore keep-alives and non-JSON frames.
        }
      }
    }
  }
}

function normaliseEvent(raw: Record<string, unknown>): StreamEvent | null {
  const type = String(raw.type ?? "");

  // Supabase edge function vocabulary
  if (type === "token") return { type: "token", delta: String(raw.delta ?? "") };
  if (type === "sources") return { type: "sources", sources: (raw.sources ?? []) as SourceRef[] };
  if (type === "done")
    return {
      type: "done",
      text: typeof raw.text === "string" ? raw.text : undefined,
      qualityScore: typeof raw.quality_score === "number" ? raw.quality_score : undefined,
      latencyMs: typeof raw.latency_ms === "number" ? raw.latency_ms : undefined,
    };
  if (type === "error") return { type: "error", message: String(raw.message ?? "Something went wrong") };

  // Local FastAPI vocabulary: {type: "content"|"done"|"error", data: string}
  if (type === "content") return { type: "token", delta: String(raw.data ?? "") };
  if (type === "done") return { type: "done", text: String(raw.data ?? "") };
  if (type === "error") return { type: "error", message: String(raw.data ?? "Something went wrong") };

  return null;
}

/* ------------------------------------------------------------------ */
/* Read APIs                                                           */
/* ------------------------------------------------------------------ */

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T | null> {
  const supabase = createClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    console.error(`[rpc:${fn}]`, error.message);
    return null;
  }
  return (data ?? null) as T | null;
}

export async function fetchCorpusStats(): Promise<CorpusStats | null> {
  if (isSupabaseConfigured) {
    const stats = await rpc<CorpusStats>("corpus_stats", {});
    if (stats) return stats;
  }
  if (!LOCAL_API) return null;
  try {
    const res = await fetch(`${LOCAL_API.replace(/\/$/, "")}/stats`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, number>;
    return {
      documents: data.documents ?? data.doc_count ?? 0,
      chunks: data.chunks ?? data.chunk_count ?? 0,
      ministries: data.ministries ?? 0,
      services: data.services ?? 0,
      last_ingested_at: null,
    };
  } catch {
    return null;
  }
}

export interface DocumentFilters {
  query?: string;
  ministry?: string | null;
  limit?: number;
}

export async function fetchDocuments({
  query = "",
  ministry = null,
  limit = 60,
}: DocumentFilters): Promise<DocumentRow[]> {
  if (isSupabaseConfigured) {
    const rows = await rpc<DocumentRow[]>("search_documents", {
      search_query: query || null,
      filter_ministry: ministry,
      max_rows: limit,
    });
    if (rows) return rows;
    const supabase = createClient();
    if (!supabase) return [];
    let builder = supabase
      .from("documents")
      .select(
        "id,notice_id,title,ministry,service_name,category,language,page_count,chunk_count,published_at,created_at,source_url,uploaded_by",
      )
      .order("created_at", { ascending: false })
      .limit(limit);
    if (ministry) builder = builder.eq("ministry", ministry);
    if (query) builder = builder.ilike("title", `%${query}%`);
    const { data } = await builder;
    return (data as DocumentRow[] | null) ?? [];
  }

  if (!LOCAL_API) return [];
  try {
    const res = await fetch(`${LOCAL_API.replace(/\/$/, "")}/ministries`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as { ministries?: string[] };
    return (data.ministries ?? []).map((name, index) => ({
      id: `ministry-${index}`,
      notice_id: null,
      title: name,
      ministry: name,
      service_name: null,
      category: null,
      language: "ne",
      page_count: null,
      chunk_count: null,
      published_at: null,
      created_at: new Date().toISOString(),
      source_url: null,
    }));
  } catch {
    return [];
  }
}

/**
 * Removes a document you uploaded; admins may remove any document. The edge
 * function owns authorisation, storage cleanup and cache invalidation.
 */
export async function deleteDocument(id: string): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new ApiError("Removing documents needs the hosted backend.", "local_mode");
  }
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/documents?id=${encodeURIComponent(id)}`,
    { method: "DELETE", headers: await authHeaders() },
  );
  if (response.ok) return;

  let message = `Could not remove the document (HTTP ${response.status})`;
  let code: string | undefined;
  try {
    const data = (await response.json()) as { message?: string; code?: string };
    if (data.message) message = data.message;
    code = data.code;
  } catch {
    // non-JSON error body
  }
  throw new ApiError(message, code);
}

export async function fetchMinistries(): Promise<string[]> {
  if (isSupabaseConfigured) {
    const supabase = createClient();
    if (!supabase) return [];
    const { data } = await supabase
      .from("documents")
      .select("ministry")
      .not("ministry", "is", null)
      .limit(1000);
    const unique = new Set<string>();
    for (const row of (data as { ministry: string | null }[] | null) ?? []) {
      if (row.ministry) unique.add(row.ministry);
    }
    return [...unique].sort();
  }
  if (!LOCAL_API) return [];
  try {
    const res = await fetch(`${LOCAL_API.replace(/\/$/, "")}/ministries`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as { ministries?: string[] };
    return data.ministries ?? [];
  } catch {
    return [];
  }
}

export async function fetchDashboard(days = 30): Promise<DashboardStats | null> {
  if (!isSupabaseConfigured) {
    if (!LOCAL_API) return null;
    try {
      const res = await fetch(`${LOCAL_API.replace(/\/$/, "")}/analytics`, { cache: "no-store" });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        total_queries?: number;
        successful_queries?: number;
        failed_queries?: number;
        avg_response_time?: number;
        queries_by_language?: Record<string, number>;
      };
      return {
        window_days: days,
        total_queries: data.total_queries ?? 0,
        answered_queries: data.successful_queries ?? 0,
        failure_rate:
          data.total_queries && data.failed_queries
            ? (data.failed_queries / data.total_queries) * 100
            : 0,
        avg_latency_ms: Math.round((data.avg_response_time ?? 0) * 1000),
        avg_quality: 0,
        language_split: {
          en: data.queries_by_language?.en ?? 0,
          ne: data.queries_by_language?.ne ?? 0,
        },
        daily: [],
        top_documents: [],
        quality_buckets: [],
      };
    } catch {
      return null;
    }
  }
  return rpc<DashboardStats>("dashboard_stats", { window_days: days });
}

export async function submitFeedback(
  messageId: string,
  rating: "up" | "down",
  comment?: string,
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const supabase = createClient();
  if (!supabase) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.from("feedback").insert({
    message_id: messageId,
    user_id: user?.id ?? null,
    rating: rating === "up" ? 1 : -1,
    comment: comment ?? null,
  });
}
