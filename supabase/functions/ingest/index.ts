import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { extractText, getDocumentProxy } from "npm:unpdf@0.12.1";
import { json, preflight } from "../_shared/cors.ts";
import { embedDocuments } from "../_shared/llm.ts";
import { detectLanguage } from "../_shared/scoring.ts";
import { resolveUser, serviceClient } from "../_shared/supabase.ts";

const CHUNK_WORDS = 150;
const CHUNK_OVERLAP = 30;
const MAX_BYTES = 25 * 1024 * 1024;

async function extractDocumentText(file: File): Promise<{ text: string; pages: number | null }> {
  const name = file.name.toLowerCase();
  const buffer = new Uint8Array(await file.arrayBuffer());

  if (name.endsWith(".pdf")) {
    const pdf = await getDocumentProxy(buffer);
    const { totalPages, text } = await extractText(pdf, { mergePages: true });
    return { text: Array.isArray(text) ? text.join("\n\n") : text, pages: totalPages };
  }

  if (name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".csv")) {
    return { text: new TextDecoder().decode(buffer), pages: null };
  }

  throw new Error("Unsupported file type. Send PDF, TXT, MD or CSV.");
}

/** Word-based chunking that mirrors the Python ingestion defaults (150/30). */
function chunkText(text: string): string[] {
  const words = text.replace(/\r\n/g, "\n").split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const chunks: string[] = [];
  const step = CHUNK_WORDS - CHUNK_OVERLAP;
  for (let start = 0; start < words.length; start += step) {
    const slice = words.slice(start, start + CHUNK_WORDS);
    if (slice.length < 25 && chunks.length > 0) break;
    chunks.push(slice.join(" "));
    if (start + CHUNK_WORDS >= words.length) break;
  }
  return chunks;
}

async function isAdmin(request: Request, userId: string | null): Promise<boolean> {
  const secret = Deno.env.get("INGEST_SECRET");
  if (secret && request.headers.get("x-ingest-secret") === secret) return true;
  if (!userId) return false;
  const supabase = serviceClient();
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  return data?.role === "admin";
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return preflight();
  if (request.method !== "POST") return json({ message: "Method not allowed" }, 405);

  const user = await resolveUser(request);
  if (!(await isAdmin(request, user?.id ?? null))) {
    return json({ message: "Ingestion requires an admin account or ingest secret." }, 403);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ message: "Expected multipart/form-data" }, 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) return json({ message: "file is required" }, 400);
  if (file.size > MAX_BYTES) return json({ message: "File exceeds 25 MB" }, 413);

  const title = String(form.get("title") ?? "").trim();
  if (!title) return json({ message: "title is required" }, 400);

  const ministry = String(form.get("ministry") ?? "").trim() || null;
  const serviceName = String(form.get("service_name") ?? "").trim() || null;
  const noticeId = String(form.get("notice_id") ?? "").trim() || null;
  const category = String(form.get("category") ?? "").trim() || null;
  const publishedAt = String(form.get("published_at") ?? "").trim() || null;
  const sourceUrl = String(form.get("source_url") ?? "").trim() || null;
  const languageHint = String(form.get("language") ?? "").trim();

  const supabase = serviceClient();

  let text: string;
  let pages: number | null = null;
  try {
    const extracted = await extractDocumentText(file);
    text = extracted.text;
    pages = extracted.pages;
  } catch (error) {
    return json({ message: (error as Error).message }, 415);
  }

  if (text.trim().length < 80) {
    return json(
      { message: "Extracted text is too short. The file may be a scanned image without OCR." },
      422,
    );
  }

  const chunks = chunkText(text);
  if (chunks.length === 0) return json({ message: "No usable text chunks produced" }, 422);

  const storagePath = `${crypto.randomUUID()}/${file.name.replace(/[^\w.\-]+/g, "_")}`;
  const upload = await supabase.storage.from("documents").upload(storagePath, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });

  const { data: document, error: documentError } = await supabase
    .from("documents")
    .insert({
      notice_id: noticeId,
      title,
      ministry,
      service_name: serviceName,
      category,
      source_url: sourceUrl,
      storage_path: upload.error ? null : storagePath,
      language: languageHint === "ne" || languageHint === "en" ? languageHint : detectLanguage(text),
      page_count: pages,
      chunk_count: chunks.length,
      published_at: publishedAt,
      ingest_status: "pending",
      uploaded_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (documentError || !document) {
    return json({ message: documentError?.message ?? "Document insert failed" }, 500);
  }

  try {
    const vectors = await embedDocuments(chunks);
    const rows = chunks.map((content, index) => ({
      document_id: document.id,
      chunk_index: index,
      content,
      token_count: content.split(/\s+/).length,
      embedding: vectors[index],
    }));

    for (let offset = 0; offset < rows.length; offset += 100) {
      const { error } = await supabase.from("chunks").insert(rows.slice(offset, offset + 100));
      if (error) throw new Error(error.message);
    }

    await supabase
      .from("documents")
      .update({ ingest_status: "ready" })
      .eq("id", document.id);

    // New source material invalidates every cached answer: a previously
    // "not in the record" refusal may now be answerable.
    const { error: purgeError } = await supabase
      .from("query_cache")
      .delete()
      .gte("created_at", "1970-01-01T00:00:00Z");
    if (purgeError) console.error("cache purge failed", purgeError.message);

    return json({
      document_id: document.id,
      title,
      chunks: chunks.length,
      pages,
      storage_path: upload.error ? null : storagePath,
    });
  } catch (error) {
    await supabase
      .from("documents")
      .update({ ingest_status: "failed" })
      .eq("id", document.id);

    const detail = (error as Error).message;
    if (detail.includes("(429)") || detail.toLowerCase().includes("quota")) {
      return json(
        {
          document_id: document.id,
          message:
            "Embedding quota is exhausted for today, so the passages could not be indexed. The document is saved and marked failed — retry after the quota resets.",
        },
        429,
      );
    }
    return json({ message: `Ingestion failed: ${detail}` }, 500);
  }
});
