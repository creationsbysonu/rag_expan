"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, Sparkles } from "lucide-react";
import { BrandMark } from "@/components/brand";
import { streamChat } from "@/lib/api";
import type { ChatMessage, Locale, SourceRef } from "@/lib/types";
import { cn } from "@/lib/utils";

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `e_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

const SUGGESTIONS = [
  "Which office issues a PAN registration?",
  "What changed in the latest procurement directive?",
  "Which ministry publishes vehicle tax notices?",
];

/**
 * Compact chat surface used by the /embed route.
 * Deliberately free of site chrome so it can live inside an iframe.
 */
export function EmbedChat({ accent }: { accent?: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [locale] = useState<Locale>("en");
  const [sessionId] = useState(newId);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || streaming) return;

      const assistantId = newId();
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: "user", content: trimmed, createdAt: new Date().toISOString() },
        { id: assistantId, role: "assistant", content: "", sources: [], pending: true },
      ]);
      setInput("");
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await streamChat({
          question: trimmed,
          sessionId,
          locale,
          signal: controller.signal,
          onEvent: (event) => {
            if (event.type === "token") {
              const delta = event.delta ?? "";
              if (!delta) return;
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === assistantId
                    ? { ...message, content: message.content + delta }
                    : message,
                ),
              );
            } else if (event.type === "sources") {
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === assistantId
                    ? { ...message, sources: (event.sources ?? []) as SourceRef[] }
                    : message,
                ),
              );
            } else if (event.type === "done") {
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === assistantId
                    ? {
                        ...message,
                        content: event.text?.trim() || message.content,
                        pending: false,
                        qualityScore: event.qualityScore ?? null,
                      }
                    : message,
                ),
              );
            } else if (event.type === "error") {
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === assistantId
                    ? { ...message, pending: false, error: event.message }
                    : message,
                ),
              );
            }
          },
        });
      } catch (error) {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId && message.pending
              ? {
                  ...message,
                  pending: false,
                  error: controller.signal.aborted ? null : (error as Error).message,
                }
              : message,
          ),
        );
      } finally {
        setStreaming(false);
        abortRef.current = null;
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId && message.pending ? { ...message, pending: false } : message,
          ),
        );
      }
    },
    [locale, sessionId, streaming],
  );

  return (
    <div className="flex h-[100dvh] flex-col bg-ink-950 text-bone-100">
      <div className="flex shrink-0 items-center justify-between border-b border-bone-100/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <BrandMark className="h-6 w-6" />
          <div>
            <p className="devanagari text-[12.5px] leading-none text-bone-100">अभिलेख</p>
            <p className="mt-1 flex items-center gap-1.5 font-mono text-[8.5px] uppercase tracking-[0.14em] text-bone-500">
              <span
                className="h-1 w-1 rounded-full"
                style={{ background: accent ?? "#dfa851" }}
                aria-hidden
              />
              grounded · cited
            </p>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div>
            <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-bone-500">
              <Sparkles className="h-3 w-3" /> Ask the record
            </p>
            <div className="mt-4 space-y-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => send(suggestion)}
                  className="block w-full rounded-[4px] border border-bone-100/10 bg-ink-900 px-3 py-2.5 text-left text-[12px] leading-snug text-bone-300 transition-colors hover:border-brass-400/40 hover:text-bone-100"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div key={message.id}>
                {message.role === "user" ? (
                  <p className="ml-auto max-w-[85%] rounded-[5px] bg-bone-100/[0.07] px-3 py-2 text-right text-[12.5px] leading-snug text-bone-100">
                    {message.content}
                  </p>
                ) : (
                  <div className="text-[12.5px] leading-relaxed text-bone-200">
                    {message.content ? (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    ) : message.pending ? (
                      <span className="inline-flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-bone-500">
                        <Loader2 className="h-3 w-3 animate-spin" /> retrieving
                      </span>
                    ) : null}
                    {message.error && (
                      <p className="mt-1 text-[11.5px] text-vermillion-400">{message.error}</p>
                    )}
                    {message.sources && message.sources.length > 0 && (
                      <p className="mt-2 font-mono text-[8.5px] uppercase tracking-[0.1em] text-bone-500">
                        {message.sources.length} source
                        {message.sources.length > 1 ? "s" : ""} ·{" "}
                        {message.sources
                          .slice(0, 2)
                          .map((source) => source.title)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          send(input);
        }}
        className="shrink-0 border-t border-bone-100/10 p-3"
      >
        <div className="flex items-end gap-2 rounded-[5px] border border-bone-100/15 bg-ink-900 px-2.5 py-2 focus-within:border-brass-400/50">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder="Ask about a notice…"
            className="max-h-24 min-h-[24px] flex-1 resize-none bg-transparent text-[12.5px] leading-relaxed text-bone-100 placeholder:text-bone-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className={cn(
              "grid h-7 w-7 shrink-0 place-items-center rounded-[3px] text-ink-950 transition-opacity",
              streaming || !input.trim() ? "opacity-30" : "opacity-100",
            )}
            style={{ background: accent ?? "#dfa851" }}
            aria-label="Send"
          >
            {streaming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" />}
          </button>
        </div>
        <p className="mt-2 text-center font-mono text-[8px] uppercase tracking-[0.12em] text-bone-500">
          Answers cite the record · verify before acting
        </p>
      </form>
    </div>
  );
}
