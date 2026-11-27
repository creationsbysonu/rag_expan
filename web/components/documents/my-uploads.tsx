"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteDocument,
  fetchMyDocuments,
  fetchUploadUsage,
  purgeDocument,
  restoreDocument,
} from "@/lib/api";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { MyDocumentRow } from "@/lib/types";
import { cn, formatNumber, relativeTime } from "@/lib/utils";

function daysLeft(iso: string) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

function Status({ row }: { row: MyDocumentRow }) {
  if (row.deleted_at) {
    return (
      <span className="rounded-[2px] border border-brass-500/30 px-1.5 py-[1px] font-mono text-[9px] uppercase tracking-[0.08em] text-brass-300">
        Trash · {daysLeft(row.purge_at ?? row.deleted_at)}d
      </span>
    );
  }
  const state = row.ingest_status ?? "ready";
  return (
    <span
      className={cn(
        "rounded-[2px] border px-1.5 py-[1px] font-mono text-[9px] uppercase tracking-[0.08em]",
        state === "ready" && "border-emerald-400/25 text-emerald-300",
        state === "pending" && "border-bone-100/20 text-bone-300",
        state === "failed" && "border-red-400/30 text-red-300",
      )}
    >
      {state === "ready" ? "Indexed" : state}
    </span>
  );
}

export function MyUploads({ anonymous = false }: { anonymous?: boolean }) {
  const [rows, setRows] = useState<MyDocumentRow[] | null>(null);
  const [usage, setUsage] = useState<{ limit: number; used: number } | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchMyDocuments()
      .then(setRows)
      .catch(() => setRows([]));
    fetchUploadUsage()
      .then(setUsage)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setRows([]);
      return;
    }
    const supabase = createClient();
    if (!supabase) {
      setRows([]);
      return;
    }
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) load();
      else setRows([]);
    });
  }, [load]);

  async function act(row: MyDocumentRow, action: "trash" | "restore" | "purge") {
    if (
      action === "purge" &&
      !window.confirm(
        `Delete “${row.title}” permanently?\n\nIts passages and the stored original are destroyed. This cannot be undone.`,
      )
    ) {
      return;
    }
    setPending(row.id);
    try {
      if (action === "trash") await deleteDocument(row.id);
      if (action === "restore") await restoreDocument(row.id);
      if (action === "purge") await purgeDocument(row.id);
      toast.success(
        action === "trash"
          ? "Moved to trash — restorable for 7 days"
          : action === "restore"
            ? "Restored to the corpus"
            : "Deleted permanently",
        { description: row.title },
      );
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That did not work");
    } finally {
      setPending(null);
    }
  }

  const active = rows?.filter((row) => !row.deleted_at).length ?? 0;
  const trashed = rows?.filter((row) => row.deleted_at).length ?? 0;
  const remaining = usage ? Math.max(0, usage.limit - usage.used) : null;

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-mono">Your uploads</p>
          <p className="mt-2 text-[12.5px] text-bone-400">
            {rows === null
              ? "Loading…"
              : `${active} in the corpus${trashed ? ` · ${trashed} in trash` : ""}`}
            {remaining !== null ? (
              <span className="text-bone-500">
                {" "}
                · {remaining} of {usage?.limit} uploads left today
              </span>
            ) : null}
          </p>
        </div>
        <Link
          href="/upload"
          className="inline-flex h-9 items-center gap-1.5 rounded-[4px] border border-bone-100/20 px-3.5 text-[12.5px] text-bone-200 transition-colors hover:border-brass-400/50 hover:text-brass-300"
        >
          <Plus className="h-3.5 w-3.5" /> Publish a document
        </Link>
      </div>

      {rows === null ? (
        <div className="mt-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-bone-500">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading your uploads
        </div>
      ) : rows.length === 0 ? (
        <div className="panel mt-4 px-5 py-8">
          <FileText className="h-5 w-5 text-bone-500" strokeWidth={1.25} />
          <p className="mt-3 text-[13px] text-bone-200">Nothing published yet.</p>
          <p className="mt-1.5 max-w-[54ch] text-[12.5px] leading-relaxed text-bone-400">
            {anonymous
              ? "Anonymous sessions can ask questions but cannot publish. Sign in with an email account to add a document — you can remove it again at any time."
              : "Upload a notice, directive or manual. It is chunked, embedded and citable within a minute, and you can retract it later."}
          </p>
          <Link
            href={anonymous ? "/login" : "/upload"}
            className="mt-4 inline-flex h-9 items-center rounded-[4px] bg-bone-50 px-3.5 text-[12.5px] font-medium text-ink-950 hover:bg-brass-200"
          >
            {anonymous ? "Sign in" : "Publish a document"}
          </Link>
        </div>
      ) : (
        <ul className="panel mt-4 divide-y divide-bone-100/8">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "truncate text-[13px]",
                      row.deleted_at ? "text-bone-400 line-through decoration-bone-100/20" : "text-bone-100",
                    )}
                  >
                    {row.title}
                  </span>
                  <Status row={row} />
                </div>
                <p className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.08em] text-bone-500">
                  {formatNumber(row.chunk_count ?? 0)} passages ·{" "}
                  {row.deleted_at
                    ? `trashed ${relativeTime(row.deleted_at)}`
                    : `added ${relativeTime(row.created_at)}`}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {row.deleted_at ? (
                  <>
                    <button
                      type="button"
                      onClick={() => act(row, "restore")}
                      disabled={pending === row.id}
                      className="inline-flex h-8 items-center gap-1.5 rounded-[4px] border border-bone-100/15 px-2.5 text-[11.5px] text-bone-200 hover:border-brass-400/50 hover:text-brass-300 disabled:opacity-50"
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
                      onClick={() => act(row, "purge")}
                      disabled={pending === row.id}
                      className="inline-flex h-8 items-center gap-1.5 rounded-[4px] px-2.5 text-[11.5px] text-bone-500 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete forever
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => act(row, "trash")}
                    disabled={pending === row.id}
                    className="inline-flex h-8 items-center gap-1.5 rounded-[4px] px-2.5 text-[11.5px] text-bone-500 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
                  >
                    {pending === row.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                    Move to trash
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
