"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy, TriangleAlert } from "lucide-react";
import { SourceCard } from "./source-card";
import type { ChatMessage } from "@/lib/types";
import { cn, formatLatency } from "@/lib/utils";

function GroundingBadge({ score }: { score: number }) {
  const tone =
    score >= 80
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      : score >= 50
        ? "border-brass-500/30 bg-brass-500/10 text-brass-300"
        : "border-vermillion-500/35 bg-vermillion-500/10 text-vermillion-400";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[3px] border px-1.5 py-[2px] font-mono text-[9px] uppercase tracking-[0.12em]",
        tone,
      )}
      title="Automatic grounding score for this answer"
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full rounded-full bg-current opacity-60" />
      </span>
      {score}
    </span>
  );
}

export function MessageBlock({
  message,
  streaming,
}: {
  message: ChatMessage;
  streaming: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  async function copy() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked.
    }
  }

  if (isUser) {
    return (
      <div className="animate-rise border-l-2 border-bone-100/15 pl-4">
        <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-bone-500">You</p>
        <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-relaxed text-bone-100">
          {message.content}
        </p>
      </div>
    );
  }

  return (
    <div className="animate-rise">
      <div className="flex items-center gap-2.5">
        <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-brass-300">
          Record
        </span>
        <span className="h-px flex-1 bg-bone-100/8" />
        {!streaming && typeof message.qualityScore === "number" ? (
          <GroundingBadge score={message.qualityScore} />
        ) : null}
        {!streaming && message.latencyMs ? (
          <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-bone-500">
            {formatLatency(message.latencyMs)}
          </span>
        ) : null}
      </div>

      {message.error ? (
        <div className="mt-3 flex items-start gap-2.5 rounded-[4px] border border-vermillion-500/30 bg-vermillion-500/[0.06] px-3 py-2.5">
          <TriangleAlert className="mt-[1px] h-3.5 w-3.5 shrink-0 text-vermillion-400" />
          <p className="text-[12.5px] leading-relaxed text-bone-200">{message.error}</p>
        </div>
      ) : (
        <div className="mt-2.5">
          <div className={cn("answer-prose", streaming && "caret")}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ node: _node, ...props }) => (
                  <a {...props} target="_blank" rel="noopener noreferrer" />
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {!streaming && !message.error && (
        <div className="mt-3 flex items-center gap-1">
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1.5 rounded-[3px] px-1.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.1em] text-bone-500 transition-colors hover:bg-bone-100/5 hover:text-bone-200"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>

        </div>
      )}

      {/* Mobile evidence trail */}
      {!streaming && message.sources?.length ? (
        <details className="mt-4 border-t border-bone-100/8 pt-3 lg:hidden">
          <summary className="cursor-pointer list-none font-mono text-[9.5px] uppercase tracking-[0.14em] text-bone-500">
            {message.sources.length} source passages
          </summary>
          <div className="mt-2.5 space-y-1.5">
            {message.sources.map((source, index) => (
              <SourceCard key={`${source.chunkId ?? index}`} source={source} index={index} compact />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
