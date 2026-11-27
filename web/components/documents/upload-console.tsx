"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CheckCircle2, FileText, Loader2, UploadCloud, X } from "lucide-react";
import { createClient, isSupabaseConfigured, SUPABASE_URL } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const ACCEPT = ".pdf,.txt,.md,.csv";
const MAX_BYTES = 25 * 1024 * 1024;

type IngestResult = {
  document_id: string;
  title: string;
  chunks: number;
  pages: number | null;
};

type SessionState = {
  email: string | null;
  role: string | null;
  token: string | null;
  anonymous: boolean;
  loading: boolean;
};

export function UploadConsole() {
  const [session, setSession] = useState<SessionState>({
    email: null,
    role: null,
    token: null,
    anonymous: false,
    loading: true,
  });
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [ministry, setMinistry] = useState("");
  const [category, setCategory] = useState("");
  const [noticeId, setNoticeId] = useState("");
  const [publishedAt, setPublishedAt] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IngestResult | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setSession({ email: null, role: null, token: null, anonymous: false, loading: false });
      return;
    }
    const supabase = createClient();
    if (!supabase) return;

    supabase.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user ?? null;
      let role: string | null = null;
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        role = (profile as { role?: string } | null)?.role ?? "user";
      }
      setSession({
        email: user?.email ?? null,
        role,
        token: data.session?.access_token ?? null,
        anonymous: Boolean(user && ((user as { is_anonymous?: boolean }).is_anonymous ?? !user.email)),
        loading: false,
      });
    });
  }, []);

  const acceptFile = useCallback((next: File | null) => {
    setError(null);
    setResult(null);
    if (!next) {
      setFile(null);
      return;
    }
    if (next.size > MAX_BYTES) {
      setError("That file is larger than 25 MB. Split it first.");
      return;
    }
    const ok = /\.(pdf|txt|md|csv)$/i.test(next.name);
    if (!ok) {
      setError("Send a PDF, TXT, MD or CSV file.");
      return;
    }
    setFile(next);
    setTitle((current) => current || next.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file || !title.trim() || busy) return;
    if (!session.token) {
      setError("Sign in to publish a document.");
      return;
    }

    setBusy(true);
    setError(null);
    setResult(null);

    const body = new FormData();
    body.append("file", file);
    body.append("title", title.trim());
    if (ministry.trim()) body.append("ministry", ministry.trim());
    if (category.trim()) body.append("category", category.trim());
    if (noticeId.trim()) body.append("notice_id", noticeId.trim());
    if (publishedAt) body.append("published_at", publishedAt);
    if (sourceUrl.trim()) body.append("source_url", sourceUrl.trim());

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/ingest`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.token}`, apikey: `${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""}` },
        body,
      });
      const payload = (await response.json().catch(() => ({}))) as Partial<IngestResult> & {
        message?: string;
      };

      if (!response.ok) {
        if (response.status === 401) {
          setError("Sign in to publish a document.");
        } else if (response.status === 403) {
          setError(
            payload.message ?? "Anonymous sessions cannot publish. Sign in with an email account.",
          );
        } else if (response.status === 429) {
          setError(
            payload.message ?? "Embedding quota reached for today. Try again after the quota resets.",
          );
        } else {
          setError(payload.message ?? `Upload failed (${response.status}).`);
        }
        return;
      }

      setResult({
        document_id: String(payload.document_id ?? ""),
        title: String(payload.title ?? title),
        chunks: Number(payload.chunks ?? 0),
        pages: payload.pages ?? null,
      });
      toast.success(`Indexed ${payload.chunks ?? 0} passages`);
      setFile(null);
      setTitle("");
      setCategory("");
      setNoticeId("");
      setPublishedAt("");
      setSourceUrl("");
      if (inputRef.current) inputRef.current.value = "";
    } catch (caught) {
      setError((caught as Error).message || "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="panel p-6">
        <p className="text-[13px] text-bone-300">
          Uploads need a configured Supabase project. Copy <code>web/.env.example</code> to{" "}
          <code>web/.env.local</code> and restart the dev server.
        </p>
      </div>
    );
  }

  if (!session.loading && !session.token) {
    return (
      <div className="panel p-6">
        <p className="label-mono">Sign-in required</p>
        <h2 className="mt-3 font-display text-[24px] text-bone-50">Sign in to publish.</h2>
        <p className="mt-3 max-w-[52ch] text-[13px] leading-relaxed text-bone-400">
          Any signed-in person can add a document, and the account that published it stays attached
          to it. Anonymous sessions can ask questions but not write to the shared corpus.
        </p>
        <Link
          href="/login"
          className="mt-5 inline-flex h-10 items-center rounded-[5px] bg-bone-50 px-4 text-[13px] font-medium text-ink-950 hover:bg-brass-200"
        >
          Sign in
        </Link>
      </div>
    );
  }

  const cannotPublish = !session.loading && Boolean(session.token) && session.anonymous;

  return (
    <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
      <form onSubmit={submit} className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-bone-100/8 px-5 py-3">
          <span className="label-mono">Document</span>
          <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-bone-500">
            PDF · TXT · MD · CSV · ≤25 MB
          </span>
        </div>

        <div className="space-y-5 p-5">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              acceptFile(event.dataTransfer.files?.[0] ?? null);
            }}
            className={cn(
              "relative flex flex-col items-center justify-center rounded-[5px] border border-dashed px-6 py-10 text-center transition-colors",
              dragging
                ? "border-brass-400/60 bg-brass-500/[0.06]"
                : "border-bone-100/20 bg-ink-900/40",
            )}
          >
            {file ? (
              <>
                <FileText className="h-6 w-6 text-brass-300" />
                <p className="mt-3 max-w-[38ch] truncate text-[13px] text-bone-100">{file.name}</p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-bone-500">
                  {(file.size / 1024).toFixed(0)} KB
                </p>
                <button
                  type="button"
                  onClick={() => acceptFile(null)}
                  className="mt-3 inline-flex items-center gap-1 font-mono text-[9.5px] uppercase tracking-[0.1em] text-bone-400 hover:text-vermillion-400"
                >
                  <X className="h-3 w-3" /> Remove
                </button>
              </>
            ) : (
              <>
                <UploadCloud className="h-6 w-6 text-bone-400" />
                <p className="mt-3 text-[13px] text-bone-200">Drop a file here</p>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="mt-3 inline-flex h-9 items-center rounded-[4px] border border-bone-100/20 px-3.5 text-[12px] text-bone-200 hover:border-brass-400/50 hover:text-brass-300"
                >
                  Choose file
                </button>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(event) => acceptFile(event.target.files?.[0] ?? null)}
            />
          </div>

          <Field label="Title" required>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Notice on mandatory licensing, 2081"
              className={inputClass}
              required
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ministry">
              <input
                value={ministry}
                onChange={(event) => setMinistry(event.target.value)}
                placeholder="Ministry of Finance"
                className={inputClass}
              />
            </Field>
            <Field label="Category">
              <input
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="Notice · Gazette"
                className={inputClass}
              />
            </Field>
            <Field label="Notice ID">
              <input
                value={noticeId}
                onChange={(event) => setNoticeId(event.target.value)}
                placeholder="2081/082-14"
                className={inputClass}
              />
            </Field>
            <Field label="Published">
              <input
                type="date"
                value={publishedAt}
                onChange={(event) => setPublishedAt(event.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Source URL">
            <input
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://…"
              className={inputClass}
            />
          </Field>

          {error && (
            <p className="rounded-[4px] border border-vermillion-400/30 bg-vermillion-500/[0.08] px-3 py-2.5 text-[12px] leading-relaxed text-vermillion-300">
              {error}
            </p>
          )}

          {result && (
            <div className="flex items-start gap-2.5 rounded-[4px] border border-emerald-400/25 bg-emerald-500/[0.07] px-3 py-2.5">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
              <p className="text-[12px] leading-relaxed text-emerald-200">
                Added {result.chunks} passages
                {result.pages ? ` across ${result.pages} pages` : ""}. It is searchable now —{" "}
                <Link href="/documents" className="underline decoration-emerald-300/40">
                  view the corpus
                </Link>
                .
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !file || !title.trim() || cannotPublish}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[5px] bg-bone-50 text-[13.5px] font-medium text-ink-950 transition-colors hover:bg-brass-200 disabled:cursor-not-allowed disabled:bg-bone-100/20 disabled:text-bone-500"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Extracting, chunking, embedding…
              </>
            ) : (
              "Index document"
            )}
          </button>
          {busy && (
            <p className="text-center font-mono text-[9.5px] uppercase tracking-[0.12em] text-bone-500">
              Large files take up to a minute — keep this tab open
            </p>
          )}
        </div>
      </form>

      <div className="space-y-5">
        <div className="panel p-5">
          <span className="label-mono">Pipeline</span>
          <ol className="mt-4 space-y-3">
            {[
              ["Extract", "Text is pulled from the PDF/TXT inside the Edge Function."],
              ["Chunk", "150-word windows with 30-word overlap, matching the Python defaults."],
              ["Embed", "1024-dim multilingual values, so Nepali and English share one space."],
              ["Store", "Rows land in chunks with an HNSW index; the file in Storage."],
            ].map(([step, detail], index) => (
              <li key={step} className="flex gap-3">
                <span className="mt-[2px] font-mono text-[10px] text-brass-400/70">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>
                  <span className="block text-[12.5px] text-bone-200">{step}</span>
                  <span className="mt-0.5 block text-[11.5px] leading-relaxed text-bone-500">
                    {detail}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="panel p-5">
          <span className="label-mono">Account</span>
          <p className="mt-3 truncate text-[12.5px] text-bone-200">{session.email ?? "—"}</p>
          <p className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.12em] text-bone-500">
            {session.loading
              ? "checking"
              : `${session.anonymous ? "anonymous session" : "signed in"} · ${session.role ?? "user"}`}
          </p>
          {cannotPublish && (
            <p className="mt-3 text-[11.5px] leading-relaxed text-bone-400">
              This is an anonymous session. Sign in with an email account to publish — you can
              remove anything you upload from your account page.
            </p>
          )}
          <p className="mt-3 text-[11.5px] leading-relaxed text-bone-500">
            Ten uploads per account per day. Each upload can be retracted for seven days.
          </p>
        </div>
      </div>
    </div>
  );
}

const inputClass =
  "h-10 w-full rounded-[4px] border border-bone-100/15 bg-ink-900 px-3 text-[13px] text-bone-100 placeholder:text-bone-500 focus:border-brass-400/60 focus:outline-none";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[9.5px] uppercase tracking-[0.12em] text-bone-500">
        {label}
        {required && <span className="text-brass-400"> *</span>}
      </span>
      {children}
    </label>
  );
}
