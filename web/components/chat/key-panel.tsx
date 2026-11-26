"use client";

import { useState } from "react";
import { KeyRound, X } from "lucide-react";
import { storeKey, type KeyChoice, type KeyProvider } from "@/lib/api-key";
import { cn } from "@/lib/utils";

interface KeyPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: KeyChoice | null;
  onChange: (choice: KeyChoice | null) => void;
  /** True when the deployment's own key ran out and this prompt was automatic. */
  exhausted: boolean;
}

const PROVIDERS: { id: KeyProvider; label: string; hint: string }[] = [
  {
    id: "cloudflare",
    label: "Cloudflare Workers AI",
    hint: "Free: 10,000 neurons/day · token starts with cfut_ · needs the account's token, not the global API key",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    hint: "Free: 1,000 embedding requests/day · key from aistudio.google.com",
  },
];

export function KeyPanel({ open, onOpenChange, current, onChange, exhausted }: KeyPanelProps) {
  const [key, setKey] = useState(current?.key ?? "");
  const [provider, setProvider] = useState<KeyProvider>(current?.provider ?? "cloudflare");
  const [saved, setSaved] = useState(false);

  if (!open) {
    return (
      <div className="flex items-center justify-end border-t border-bone-100/10 bg-ink-950/60 px-4 py-1.5 md:px-6">
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          className="inline-flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-bone-500 transition-colors hover:text-brass-300"
        >
          <KeyRound className="h-3 w-3" />
          {current ? "Using your key" : "Use your own API key"}
        </button>
      </div>
    );
  }

  function save() {
    const trimmed = key.trim();
    if (!trimmed) return;
    const choice: KeyChoice = { key: trimmed, provider };
    storeKey(choice);
    onChange(choice);
    setSaved(true);
  }

  function remove() {
    storeKey(null);
    onChange(null);
    setKey("");
    setSaved(false);
    onOpenChange(false);
  }

  return (
    <div className="border-t border-brass-500/25 bg-ink-900/95 px-4 py-3.5 md:px-6">
      <div className="mx-auto w-full max-w-[880px]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="label-mono text-brass-300">
              {exhausted ? "Daily limit reached" : "Your own model key"}
            </p>
            <p className="mt-1.5 max-w-[70ch] text-[12px] leading-relaxed text-bone-400">
              {exhausted
                ? "This deployment's free model allowance is used up for today. Paste your own key to keep asking — answers, citations and caching work exactly the same."
                : "Optional. Supply your own key and this session does not spend the deployment's free allowance. It is kept in this browser tab and sent only with your questions."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="mt-0.5 rounded p-1 text-bone-500 hover:bg-bone-100/5 hover:text-bone-100"
            aria-label="Close key panel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-[3px] border border-bone-100/12 p-[2px]">
            {PROVIDERS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setProvider(option.id)}
                className={cn(
                  "rounded-[2px] px-2.5 py-[4px] font-mono text-[9.5px] uppercase tracking-[0.08em] transition-colors",
                  provider === option.id
                    ? "bg-bone-100/10 text-bone-100"
                    : "text-bone-500 hover:text-bone-200",
                )}
              >
                {option.id === "cloudflare" ? "Cloudflare" : "Gemini"}
              </button>
            ))}
          </div>

          <input
            type="password"
            value={key}
            onChange={(event) => {
              setKey(event.target.value);
              setSaved(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") save();
            }}
            placeholder={provider === "cloudflare" ? "cfut_…" : "AIza…"}
            autoComplete="off"
            spellCheck={false}
            aria-label="Your API key"
            className="h-[30px] min-w-[220px] flex-1 rounded-[3px] border border-bone-100/12 bg-ink-950 px-2.5 font-mono text-[11px] text-bone-100 placeholder:text-bone-500 focus:border-brass-400/50 focus:outline-none"
          />

          <button
            type="button"
            onClick={save}
            disabled={!key.trim()}
            className="h-[30px] rounded-[3px] bg-bone-50 px-3 font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-950 hover:bg-brass-200 disabled:bg-bone-100/10 disabled:text-bone-500"
          >
            {saved ? "Saved" : "Use key"}
          </button>

          {current && (
            <button
              type="button"
              onClick={remove}
              className="h-[30px] rounded-[3px] border border-bone-100/12 px-2.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-bone-400 hover:border-vermillion-500/50 hover:text-vermillion-400"
            >
              Remove
            </button>
          )}
        </div>

        <p className="mt-2 font-mono text-[9px] leading-relaxed tracking-[0.03em] text-bone-500">
          {PROVIDERS.find((option) => option.id === provider)?.hint}
        </p>
      </div>
    </div>
  );
}
