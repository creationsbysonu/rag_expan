"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, FileText, Loader2, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteDocument, fetchDocuments, fetchMinistries } from "@/lib/api";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { DocumentRow } from "@/lib/types";
import { cn, formatNumber, relativeTime } from "@/lib/utils";
import { Input, Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/badge";

export function CorpusBrowser() {
  const [rows, setRows] = useState<DocumentRow[] | null>(null);
  const [ministries, setMinistries] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [ministry, setMinistry] = useState<string>("");
  const [sort, setSort] = useState<"recent" | "title" | "chunks">("recent");
  const [viewer, setViewer] = useState<{ id: string; admin: boolean } | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    fetchMinistries().then(setMinistries).catch(() => undefined);
  }, []);

  // Deletion is scoped: your own uploads, or anything if you are an admin.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = createClient();
    if (!supabase) return;
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      setViewer({ id: user.id, admin: (profile as { role?: string } | null)?.role === "admin" });
    });
  }, []);

  const canRemove = (row: DocumentRow) =>
    Boolean(viewer && (viewer.admin || row.uploaded_by === viewer.id));

  async function remove(row: DocumentRow) {
    const passages = formatNumber(row.chunk_count ?? 0);
    const confirmed = window.confirm(
      `Remove “${row.title}” from the corpus?\n\n` +
        `Its ${passages} passages will be deleted, cached answers cleared, and the assistant ` +
        `will no longer be able to cite it.`,
    );
    if (!confirmed) return;

    setRemoving(row.id);
    try {
      await deleteDocument(row.id);
      setRows((prev) => prev?.filter((item) => item.id !== row.id) ?? prev);
      toast.success("Document removed", { description: row.title });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove the document");
    } finally {
      setRemoving(null);
    }
  }

  useEffect(() => {
    let alive = true;
    setRows(null);
    const timer = window.setTimeout(() => {
      fetchDocuments({ query, ministry: ministry || null, limit: 120 })
        .then((data) => alive && setRows(data))
        .catch(() => alive && setRows([]));
    }, query ? 250 : 0);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [query, ministry]);

  const sorted = useMemo(() => {
    if (!rows) return null;
    const copy = [...rows];
    if (sort === "title") copy.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "chunks") copy.sort((a, b) => (b.chunk_count ?? 0) - (a.chunk_count ?? 0));
    if (sort === "recent")
      copy.sort((a, b) => (b.published_at ?? b.created_at).localeCompare(a.published_at ?? a.created_at));
    return copy;
  }, [rows, sort]);

  const totalChunks = sorted?.reduce((sum, row) => sum + (row.chunk_count ?? 0), 0) ?? 0;

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-bone-100/10 pb-5 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-[380px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-bone-500" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by title or notice id…"
            className="pl-9"
            aria-label="Filter documents"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={ministry}
            onChange={(event) => setMinistry(event.target.value)}
            aria-label="Filter by ministry"
            className="max-w-[220px]"
          >
            <option value="">All ministries</option>
            {ministries.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
          <Select
            value={sort}
            onChange={(event) => setSort(event.target.value as typeof sort)}
            aria-label="Sort documents"
          >
            <option value="recent">Most recent</option>
            <option value="title">Title A–Z</option>
            <option value="chunks">Largest first</option>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-500">
          {sorted ? `${sorted.length} records · ${formatNumber(totalChunks)} passages` : "Loading index"}
        </p>
        <p className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-bone-500 sm:block">
          Sorted by {sort}
        </p>
      </div>

      {!sorted ? (
        <div className="space-y-1">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-[62px] w-full" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="panel flex flex-col items-center justify-center px-6 py-20 text-center">
          <FileText className="h-6 w-6 text-bone-500" strokeWidth={1.25} />
          <p className="mt-4 font-display text-2xl text-bone-100">Nothing indexed under that.</p>
          <p className="mt-2 max-w-[46ch] text-[12.5px] leading-relaxed text-bone-400">
            The corpus may not include this ministry yet, or the filter is too narrow. Try clearing
            the search, or ingest a document from the admin console.
          </p>
        </div>
      ) : (
        <ol className="divide-y divide-bone-100/8 border-y border-bone-100/8">
          {sorted.map((row, index) => (
            <li key={row.id} className="group flex items-stretch">
              <a
                href={row.source_url ?? `/chat?q=${encodeURIComponent(row.title)}`}
                target={row.source_url ? "_blank" : undefined}
                rel={row.source_url ? "noopener noreferrer" : undefined}
                className="grid flex-1 grid-cols-[28px_1fr_auto] items-center gap-3 px-1 py-4 transition-colors hover:bg-bone-100/[0.025] md:grid-cols-[34px_1fr_180px_90px_auto]"
              >
                <span className="font-mono text-[10px] text-bone-500">
                  {String(index + 1).padStart(3, "0")}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[13.5px] text-bone-100 group-hover:text-bone-50">
                      {row.title}
                    </span>
                    {row.language === "ne" ? (
                      <span className="devanagari hidden shrink-0 rounded-[2px] border border-bone-100/12 px-1 py-[1px] text-[9px] text-bone-400 sm:inline">
                        ने
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[9.5px] uppercase tracking-[0.08em] text-bone-500">
                    <span className="truncate">{row.ministry ?? "Unattributed"}</span>
                    {row.service_name ? (
                      <>
                        <span className="h-0.5 w-0.5 rounded-full bg-bone-100/25" />
                        <span className="truncate">{row.service_name}</span>
                      </>
                    ) : null}
                  </span>
                </span>
                <span className="hidden font-mono text-[10px] uppercase tracking-[0.08em] text-bone-500 md:block">
                  {row.notice_id ? `Notice ${row.notice_id}` : "—"}
                </span>
                <span className="hidden text-right font-mono text-[10px] text-bone-400 md:block">
                  {row.chunk_count ? `${formatNumber(row.chunk_count)} ch` : "—"}
                </span>
                <span className="flex items-center gap-3">
                  <span className="hidden min-w-[74px] text-right font-mono text-[9.5px] uppercase tracking-[0.06em] text-bone-500 sm:block">
                    {relativeTime(row.published_at ?? row.created_at)}
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-bone-500 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brass-300" />
                </span>
              </a>
              {canRemove(row) ? (
                <button
                  type="button"
                  onClick={() => remove(row)}
                  disabled={removing === row.id}
                  title="Remove from the corpus"
                  aria-label={`Remove ${row.title} from the corpus`}
                  className="my-2 ml-1 grid w-9 shrink-0 place-items-center rounded-[4px] text-bone-500 opacity-0 transition-colors hover:bg-red-500/10 hover:text-red-300 focus-visible:opacity-100 disabled:opacity-50 md:group-hover:opacity-100 max-md:opacity-100 max-md:hover:text-red-300"
                >
                  {removing === row.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              ) : null}
            </li>
          ))}
        </ol>
      )}

      <p className="mt-5 flex items-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.12em] text-bone-500">
        <Loader2 className={cn("h-3 w-3", sorted ? "hidden" : "animate-spin")} />
        Chunk counts reflect the active embedding index
      </p>
    </div>
  );
}
