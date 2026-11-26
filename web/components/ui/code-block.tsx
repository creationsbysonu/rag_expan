"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CodeBlock({
  code,
  title,
  language,
}: {
  code: string;
  title?: string;
  language?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-[5px] border border-bone-100/10 bg-ink-900">
      <div className="flex items-center justify-between border-b border-bone-100/8 px-3.5 py-2">
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-bone-500">
          {title ?? language ?? "snippet"}
        </span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-bone-400 transition-colors hover:text-brass-300"
          aria-label="Copy snippet"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <pre className="overflow-x-auto px-3.5 py-3 font-mono text-[11.5px] leading-relaxed text-bone-200">
        <code>{code}</code>
      </pre>
    </div>
  );
}
