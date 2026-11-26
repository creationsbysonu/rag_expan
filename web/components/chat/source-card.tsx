"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink, FileText } from "lucide-react";
import type { SourceRef } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SourceCard({
  source,
  index,
  compact = false,
}: {
  source: SourceRef;
  index: number;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const confidence =
    typeof source.similarity === "number" ? Math.round(source.similarity * 100) : null;

  return (
    <div className="group border border-bone-100/10 bg-ink-900/60 transition-colors hover:border-bone-100/20">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left"
        aria-expanded={open}
      >
        <span className="mt-0.5 flex h-5 min-w-5 items-center justify-center rounded-[3px] bg-brass-500/15 font-mono text-[10px] text-brass-300">
          {index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start gap-1.5">
            <FileText className="mt-[2px] h-3 w-3 shrink-0 text-bone-500" />
            <span className="line-clamp-2 text-[12px] leading-snug text-bone-200">
              {source.title ?? source.noticeId ?? "Untitled record"}
            </span>
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-bone-500">
            {source.ministry ? <span className="truncate">{source.ministry}</span> : null}
            {source.pageHint ? <span>p. {source.pageHint}</span> : null}
            {confidence !== null ? (
              <span
                className={cn(
                  confidence >= 80
                    ? "text-emerald-400/80"
                    : confidence >= 65
                      ? "text-brass-400"
                      : "text-bone-500",
                )}
              >
                {confidence}% match
              </span>
            ) : null}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "mt-1 h-3.5 w-3.5 shrink-0 text-bone-500 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="border-t border-bone-100/8 px-3 py-3">
          <p
            className={cn(
              "whitespace-pre-wrap text-[11.5px] leading-relaxed text-bone-300",
              compact && "line-clamp-[8]",
            )}
          >
            {source.excerpt?.trim() || "No excerpt stored for this passage."}
          </p>
          <div className="mt-3 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.12em] text-bone-500">
            <span>{source.noticeId ? `Notice ${source.noticeId}` : "No notice id"}</span>
            {source.sourceUrl ? (
              <a
                href={source.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-brass-300 hover:text-brass-200"
              >
                Open
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
