export type Role = "user" | "assistant" | "system";

export type Locale = "en" | "ne";

export interface SourceRef {
  chunkId?: number | string;
  documentId?: string;
  noticeId?: string | null;
  title: string | null;
  ministry?: string | null;
  serviceName?: string | null;
  pageHint?: string | null;
  excerpt?: string | null;
  similarity?: number | null;
  sourceUrl?: string | null;
}

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  sources?: SourceRef[];
  qualityScore?: number | null;
  latencyMs?: number | null;
  createdAt?: string;
  pending?: boolean;
  error?: string | null;
}

export interface StreamEvent {
  type: "token" | "sources" | "done" | "error" | "meta";
  delta?: string;
  text?: string;
  sources?: SourceRef[];
  qualityScore?: number;
  latencyMs?: number;
  question?: string;
  message?: string;
}

export interface Conversation {
  id: string;
  title: string | null;
  language: Locale;
  created_at: string;
  updated_at: string;
}

export interface DocumentRow {
  id: string;
  notice_id: string | null;
  title: string;
  ministry: string | null;
  service_name: string | null;
  category: string | null;
  language: string | null;
  page_count: number | null;
  chunk_count: number | null;
  published_at: string | null;
  created_at: string;
  source_url: string | null;
  /** Account that ingested it; null when published with the ingest secret. */
  uploaded_by?: string | null;
  deleted_at?: string | null;
  ingest_status?: string | null;
}

/** A document in the trash, visible to its uploader and to admins. */
export interface TrashRow {
  id: string;
  title: string;
  ministry: string | null;
  notice_id: string | null;
  chunk_count: number | null;
  uploaded_by: string | null;
  deleted_at: string;
  purge_at: string;
}

/** One of the signed-in account's own uploads, including its trash state. */
export interface MyDocumentRow {
  id: string;
  title: string;
  ministry: string | null;
  notice_id: string | null;
  chunk_count: number | null;
  ingest_status: string | null;
  language: string | null;
  created_at: string;
  deleted_at: string | null;
  purge_at: string | null;
}

export interface CorpusStats {
  documents: number;
  chunks: number;
  ministries: number;
  services: number;
  last_ingested_at: string | null;
}

export interface DashboardStats {
  window_days: number;
  total_queries: number;
  answered_queries: number;
  failure_rate: number;
  avg_latency_ms: number;
  avg_quality: number;
  language_split: { en: number; ne: number };
  daily: { day: string; queries: number; avg_quality: number | null }[];
  top_documents: { title: string; hits: number }[];
  quality_buckets: { bucket: string; count: number }[];
}
