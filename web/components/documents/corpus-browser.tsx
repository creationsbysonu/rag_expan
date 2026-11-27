"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  FileText,
  Loader2,
  RotateCcw,
  Search,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import {
  deleteDocument,
  fetchDocuments,
  fetchMinistries,
  fetchTrash,
  purgeDocument,
  restoreDocument,
} from "@/lib/api";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { DocumentRow, TrashRow } from "@/lib/types";
import { cn, formatNumber, relativeTime } from "@/lib/utils";
import { Input, Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/badge";

function daysLeft(iso: string) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

export function CorpusBrowser() {
  const [rows, setRows] = useState<DocumentRow[] | null>(null);
  const [trash, setTrash] = useState<TrashRow[] | null>(null);
  const [mode, setMode] = useState<"corpus" | "trash">("corpus");
  const [ministries, setMinistries] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [ministry, setMinistry] = useState<string>("");
  const [sort, setSort] = useState<"recent" | "title" | "chunks">("recent");
  const [reload, setReload] = useState(0);
  const [viewer, setViewer] = useState<{ id: string; admin: boolean } | null>(null);
  const [pending, setPending] = useState<string | null>(null);

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
  }, [query, ministry, reload]);

  const loadTrash = useCallback(() => {
    setTrash(null);
    fetchTrash()
      .then(setTrash)
      .catch(() => setTrash([]));
  }, []);

  useEffect(() => {
    if (mode === "trash" && viewer) loadTrash();
  }, [mode, viewer, loadTrash]);

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
  const canRemove = (row: DocumentRow) =>
    Boolean(viewer && (viewer.admin || row.uploaded_by === viewer.id));

  async function moveToTrash(row: DocumentRow) {
    setPending(row.id);
    try {
      await deleteDocument(row.id);
      setRows((prev) => prev?.filter((item) => item.id !== row.id) ?? prev);
      toast.success("Moved to trash", {
        description: `${row.title} — restorable for 7 days.`,
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await restoreDocument(row.id);
              setReload((count) => count + 1);
              toast.success("Restored to the corpus");
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Could not restore");
            }
          },
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not move the document to trash");
    } finally {
      setPending(null);
    }
  }

  async function restore(row: TrashRow) {
    setPending(row.id);
    try {
      await restoreDocument(row.id);
      setTrash((prev) => prev?.filter((item) => item.id !== row.id) ?? prev);
      setReload((count) => count + 1);
      toast.success("Restored to the corpus", { description: row.title });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not restore the document");
    } finally {
      setPending(null);
    }
  }

  async function purge(row: TrashRow) {
    if (
      !window.confirm(
        `Delete “${row.title}” permanently?\n\nIts ${formatNumber(
          row.chunk_count ?? 0,
        )} passages and the stored original are destroyed. This cannot be undone.`,
      )
    ) {
      return;
    }
    setPending(row.id);
    try {
      await purgeDocument(row.id);
      setTrash((prev) => prev?.filter((item) => item.id !== row.id) ?? prev);
      toast.success("Deleted permanently", { description: row.title });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the document");
    } finally {
      setPending(null);
    }
  }

  return (
    <div>
      {viewer ? (
        <div className="mb-4 flex items-center gap-1 border-b border-bone-100/10 pb-0">
          {(
            [
              ["corpus", "Corpus"],
              ["trash", "Trash"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={cn(
                "relative -mb-px px-3 pb-3 pt-1 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors",
                mode === value ? "text-bone-100" : "text-bone-500 hover:text-bone-300",
              )}
              aria-pressed={mode === value}
            >
              {label}
              {mode === value && <span className="absolute inset-x-2 -bottom-px h-px bg-brass-400" />}
            </button>
          ))}
        </div>
      ) : null}

      {mode === "trash" ? (
        <div>
          <div className="flex items-center justify-between pb-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-500">
              {trash ? `${trash.length} in trash · auto-purge after 7 days` : "Loading trash"}
            </p>
            <button
              type="button"
              onClick={loadTrash}
              className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-bone-500 transition-colors hover:text-bone-200"
            >
              Refresh
            </button>
          </div>

          {!trash ? (
            <div className="space-y-1">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-[62px] w-full" />
              ))}
            </div>
          ) : trash.length === 0 ? (
            <div className="panel flex flex-col items-center justify-center px-6 py-16 text-center">
              <Trash2 className="h-6 w-6 text-bone-500" strokeWidth={1.25} />
              <p className="mt-4 font-display text-2xl text-bone-100">Trash is empty.</p>
              <p className="mt-2 max-w-[46ch] text-[12.5px] leading-relaxed text-bone-400">
                Documents you remove stay here for seven days, restorable in one click, before they
                are deleted for good.
              </p>
            </div>
          ) : (
            <ol className="divide-y divide-bone-100/8 border-y border-bone-100/8">
              {trash.map((row) => (
                <li key={row.id} className="grid grid-cols-1 gap-3 px-1 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] text-bone-200">{row.title}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[9.5px] uppercase tracking-[0.08em] text-bone-500">
                      <span className="truncate">{row.ministry ?? "Unattributed"}</span>
                      <span className="h-0.5 w-0.5 rounded-full bg-bone-100/25" />
                      <span>{formatNumber(row.chunk_count ?? 0)} passages</span>
                      <span className="h-0.5 w-0.5 rounded-full bg-bone-100/25" />
                      <span className="text-brass-400/80">
                        {daysLeft(row.purge_at)} day{daysLeft(row.purge_at) === 1 ? "" : "s"} left
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => restore(row)}
                      disabled={pending === row.id}
                      className="inline-flex h-8 items-center gap-1.5 rounded-[4px] border border-bone-100/15 px-3 text-[11.5px] text-bone-200 transition-colors hover:border-brass-400/50 hover:text-brass-300 disabled:opacity-50"
                    >
                      {pending === row.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3 w-3" />
                      )}
                      Restore
                    </button>
                    <button
                      type="button"
                      onClick={() => purge(row)}
                      disabled={pending === row.id}
                      className="inline-flex h-8 items-center gap-1.5 rounded-[4px] border border-transparent px-2.5 text-[11.5px] text-bone-500 transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete forever
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : (
        <>
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
              {sorted
                ? `${sorted.length} records · ${formatNumber(totalChunks)} passages`
                : "Loading index"}
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
                The corpus may not include this ministry yet, or the filter is too narrow. Try
                clearing the search, or publish a document of your own.
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
                      onClick={() => moveToTrash(row)}
                      disabled={pending === row.id}
                      title="Move to trash (restorable for 7 days)"
                      aria-label={`Move ${row.title} to trash`}
                      className="my-2 ml-1 grid w-9 shrink-0 place-items-center rounded-[4px] text-bone-500 opacity-0 transition-colors hover:bg-red-500/10 hover:text-red-300 focus-visible:opacity-100 disabled:opacity-50 md:group-hover:opacity-100 max-md:opacity-100"
                    >
                      {pending === row.id ? (
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
        </>
      )}

      <p className="mt-5 flex items-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.12em] text-bone-500">
        <Loader2 className={cn("h-3 w-3", sorted || trash ? "hidden" : "animate-spin")} />
        {mode === "trash" ? (
          <>
            <Undo2 className="h-3 w-3" /> Restoring re-indexes the same passages instantly
          </>
        ) : (
          "Chunk counts reflect the active embedding index"
        )}
      </p>
    </div>
  );
}
