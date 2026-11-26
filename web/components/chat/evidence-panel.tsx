"use client";

import { Fingerprint, Gauge, Timer } from "lucide-react";
import { SourceCard } from "./source-card";
import type { SourceRef } from "@/lib/types";
import { formatLatency } from "@/lib/utils";

export function EvidencePanel({
  sources,
  quality,
  latency,
  streaming,
  locale,
}: {
  sources: SourceRef[];
  quality: number | null;
  latency: number | null;
  streaming: boolean;
  locale: "en" | "ne";
}) {
  const ne = locale === "ne";

  return (
    <aside className="hidden w-[330px] shrink-0 border-l border-bone-100/10 bg-ink-900/30 lg:flex lg:flex-col">
      <div className="flex items-center justify-between border-b border-bone-100/10 px-4 py-3">
        <span className="label-mono">{ne ? "प्रमाण" : "Evidence"}</span>
        <span className="font-mono text-[10px] text-bone-500">
          {sources.length} {ne ? "अंश" : sources.length === 1 ? "passage" : "passages"}
        </span>
      </div>

      <div className="grid grid-cols-2 divide-x divide-bone-100/8 border-b border-bone-100/10">
        <div className="px-4 py-3">
          <span className="flex items-center gap-1.5 label-mono">
            <Gauge className="h-3 w-3" /> {ne ? "आधार" : "Grounding"}
          </span>
          <p className="mt-1.5 font-display text-xl leading-none text-bone-50">
            {typeof quality === "number" ? quality : "—"}
            <span className="ml-1 font-mono text-[9px] tracking-normal text-bone-500">/100</span>
          </p>
          <div className="mt-2 h-[2px] w-full overflow-hidden bg-bone-100/10">
            <div
              className="h-full bg-brass-400 transition-[width] duration-700"
              style={{ width: `${typeof quality === "number" ? quality : 0}%` }}
            />
          </div>
        </div>
        <div className="px-4 py-3">
          <span className="flex items-center gap-1.5 label-mono">
            <Timer className="h-3 w-3" /> {ne ? "समय" : "Latency"}
          </span>
          <p className="mt-1.5 font-display text-xl leading-none text-bone-50">
            {streaming ? "…" : formatLatency(latency)}
          </p>
          <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.1em] text-bone-500">
            {streaming ? "in flight" : "round trip"}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {sources.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <Fingerprint className="h-6 w-6 text-bone-500" strokeWidth={1.25} />
            <p className="mt-4 max-w-[24ch] text-[12px] leading-relaxed text-bone-500">
              {ne
                ? "उत्तर स्रोतसहित आएपछि यहाँ प्रमाण देखिनेछ।"
                : "Source passages appear here once an answer is grounded."}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {sources.map((source, index) => (
              <SourceCard key={`${source.chunkId ?? index}`} source={source} index={index} />
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-bone-100/10 px-4 py-3">
        <p className="font-mono text-[9px] leading-relaxed tracking-[0.04em] text-bone-500">
          Grounding scores are computed against retrieved passages. Unsupported answers are
          surfaced, not hidden.
        </p>
      </div>
    </aside>
  );
}
