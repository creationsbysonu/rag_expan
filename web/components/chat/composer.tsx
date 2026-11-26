"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Square } from "lucide-react";
import { t } from "@/lib/copy";
import type { Locale } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Kbd } from "@/components/ui/badge";

interface ComposerProps {
  onSend: (question: string) => void;
  onStop: () => void;
  streaming: boolean;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  ministries: string[];
  ministry: string | null;
  onMinistryChange: (ministry: string | null) => void;
}

export function Composer({
  onSend,
  onStop,
  streaming,
  locale,
  onLocaleChange,
  ministries,
  ministry,
  onMinistryChange,
}: ComposerProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const copy = t(locale);

  useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 200)}px`;
  }, [value]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "/" && document.activeElement?.tagName !== "TEXTAREA") {
        event.preventDefault();
        textareaRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  function submit() {
    const question = value.trim();
    if (!question || streaming) return;
    setValue("");
    onSend(question);
  }

  return (
    <div className="border-t border-bone-100/10 bg-ink-950/80 px-4 pb-4 pt-3 backdrop-blur md:px-6">
      <div
        className={cn(
          "rounded-[6px] border bg-ink-900/80 transition-colors",
          streaming ? "border-brass-500/30" : "border-bone-100/12 focus-within:border-brass-400/50",
        )}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          rows={1}
          maxLength={1000}
          placeholder={copy.askPlaceholder}
          className="max-h-[200px] w-full resize-none bg-transparent px-4 pb-1 pt-3.5 text-[14px] leading-relaxed text-bone-100 placeholder:text-bone-500 focus:outline-none"
          aria-label="Question"
        />

        <div className="flex items-center gap-2 px-3 pb-2.5 pt-1">
          <div className="flex items-center rounded-[3px] border border-bone-100/12 p-[2px]">
            {(["en", "ne"] as Locale[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onLocaleChange(option)}
                className={cn(
                  "rounded-[2px] px-2 py-[3px] font-mono text-[10px] uppercase tracking-[0.1em] transition-colors",
                  locale === option
                    ? "bg-bone-100/10 text-bone-100"
                    : "text-bone-500 hover:text-bone-200",
                )}
              >
                {option === "en" ? "EN" : "ने"}
              </button>
            ))}
          </div>

          {ministries.length > 0 && (
            <select
              value={ministry ?? ""}
              onChange={(event) => onMinistryChange(event.target.value || null)}
              className="h-[26px] max-w-[190px] truncate rounded-[3px] border border-bone-100/12 bg-ink-900 px-2 font-mono text-[10px] uppercase tracking-[0.06em] text-bone-300 hover:border-bone-100/20 focus:border-brass-400/50 focus:outline-none"
              aria-label={copy.ministryFilter}
            >
              <option value="">{copy.allMinistries}</option>
              {ministries.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          )}

          <span className="ml-auto hidden items-center gap-1.5 pr-2 font-mono text-[9.5px] uppercase tracking-[0.1em] text-bone-500 sm:flex">
            <Kbd>↵</Kbd> send
            <span className="px-0.5 text-bone-500">·</span>
            <Kbd>⇧↵</Kbd> line
          </span>

          {streaming ? (
            <button
              type="button"
              onClick={onStop}
              className="inline-flex h-8 items-center gap-1.5 rounded-[4px] border border-bone-100/15 px-2.5 font-mono text-[10px] uppercase tracking-[0.1em] text-bone-200 hover:border-vermillion-500/50 hover:text-vermillion-400"
            >
              <Square className="h-2.5 w-2.5 fill-current" />
              {copy.stop}
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!value.trim()}
              className="inline-flex h-8 w-8 items-center justify-center rounded-[4px] bg-bone-50 text-ink-950 transition-colors hover:bg-brass-200 disabled:bg-bone-100/10 disabled:text-bone-500"
              aria-label={copy.send}
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
