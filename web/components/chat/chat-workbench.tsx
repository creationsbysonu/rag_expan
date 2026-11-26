"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PanelLeft, Plus, Trash2, X } from "lucide-react";
import { MessageBlock } from "./message-block";
import { Composer } from "./composer";
import { EvidencePanel } from "./evidence-panel";
import { ApiError, streamChat, fetchMinistries, backendMode, backendLabel } from "@/lib/api";
import { KeyPanel } from "./key-panel";
import { loadKey, type KeyChoice } from "@/lib/api-key";
import { deleteSession, listSessions, saveSession, type StoredSession } from "@/lib/conversations";
import { t } from "@/lib/copy";
import type { ChatMessage, Locale } from "@/lib/types";
import { cn, relativeTime, truncate } from "@/lib/utils";

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `s_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function ChatWorkbench() {
  const [locale, setLocale] = useState<Locale>("en");
  const [sessionId, setSessionId] = useState(newId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [ministries, setMinistries] = useState<string[]>([]);
  const [ministry, setMinistry] = useState<string | null>(null);
  const [railOpen, setRailOpen] = useState(false);
  const [ownKey, setOwnKey] = useState<KeyChoice | null>(null);
  const [keyOpen, setKeyOpen] = useState(false);
  const [quotaHit, setQuotaHit] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  const copy = t(locale);

  useEffect(() => {
    listSessions().then(setSessions).catch(() => undefined);
    fetchMinistries().then(setMinistries).catch(() => undefined);
    const stored = window.localStorage.getItem("sarkar.locale");
    if (stored === "ne" || stored === "en") setLocale(stored);
    const key = loadKey();
    if (key) setOwnKey(key);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("sarkar.locale", locale);
  }, [locale]);

  // Persist the active session once streaming settles.
  useEffect(() => {
    if (streaming || messages.length === 0) return;
    const firstQuestion = messages.find((message) => message.role === "user")?.content ?? "Session";
    const session: StoredSession = {
      id: sessionId,
      title: truncate(firstQuestion, 70),
      locale,
      updatedAt: new Date().toISOString(),
      messages: messages.filter((message) => !message.pending && !message.error),
    };
    saveSession(session)
      .then(() => listSessions())
      .then(setSessions)
      .catch(() => undefined);
  }, [messages, streaming, sessionId, locale]);

  const activeAssistant = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === "assistant") return messages[index];
    }
    return null;
  }, [messages]);

  const scrollToBottom = useCallback((smooth = true) => {
    const node = scrollRef.current;
    if (!node || !stickRef.current) return;
    node.scrollTo({ top: node.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  useEffect(() => {
    scrollToBottom(false);
  }, [sessionId, scrollToBottom]);

  useEffect(() => {
    if (streaming) scrollToBottom(false);
  }, [messages, streaming, scrollToBottom]);

  const send = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || streaming) return;

      const userMessage: ChatMessage = {
        id: newId(),
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
      };
      const assistantId = newId();

      stickRef.current = true;
      setMessages((prev) => [
        ...prev,
        userMessage,
        { id: assistantId, role: "assistant", content: "", sources: [], pending: true },
      ]);
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;
      const startedAt = performance.now();

      try {
        await streamChat({
          question: trimmed,
          sessionId,
          locale,
          ministry,
          apiKey: ownKey?.key,
          keyProvider: ownKey?.provider,
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
                    ? { ...message, sources: event.sources ?? [] }
                    : message,
                ),
              );
            } else if (event.type === "done") {
              const latency = Math.round(performance.now() - startedAt);
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === assistantId
                    ? {
                        ...message,
                        content: event.text?.trim() ? event.text : message.content,
                        qualityScore: event.qualityScore ?? message.qualityScore ?? null,
                        latencyMs: event.latencyMs ?? latency,
                        pending: false,
                      }
                    : message,
                ),
              );
            } else if (event.type === "error") {
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === assistantId
                    ? { ...message, pending: false, error: event.message ?? copy.errorGeneric }
                    : message,
                ),
              );
            }
          },
        });
      } catch (error) {
        const aborted = controller.signal.aborted;
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  pending: false,
                  error: aborted ? null : (error as Error).message || copy.errorGeneric,
                }
              : message,
          ),
        );
        if (!aborted) {
          const apiError = error as ApiError;
          toast.error(apiError.message || copy.errorGeneric);
          // The deployment's free allowance is spent: offer the visitor's own key.
          if (apiError.code === "quota_exhausted") {
            setQuotaHit(true);
            setKeyOpen(true);
          }
        }
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
    [copy.errorGeneric, locale, ministry, ownKey, sessionId, streaming],
  );

  function stop() {
    abortRef.current?.abort();
    setStreaming(false);
  }

  async function openSession(session: StoredSession) {
    if (streaming) stop();
    setSessionId(session.id);
    setMessages(session.messages);
    setLocale(session.locale);
    setRailOpen(false);
    stickRef.current = true;
  }

  function startNewSession() {
    if (streaming) stop();
    setSessionId(newId());
    setMessages([]);
    setMinistry(null);
    setRailOpen(false);
  }

  async function removeSession(id: string, event: React.MouseEvent) {
    event.stopPropagation();
    await deleteSession(id);
    setSessions(await listSessions());
    if (id === sessionId) startNewSession();
  }

  const showEmpty = messages.length === 0;

  return (
    <div className="relative flex h-[calc(100dvh-4rem)] overflow-hidden">
      {/* ------------------------------- rail ------------------------------- */}
      <aside
        className={cn(
          "absolute inset-y-0 left-0 z-40 flex w-[268px] flex-col border-r border-bone-100/10 bg-ink-900 transition-transform duration-200 lg:static lg:translate-x-0",
          railOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-bone-100/10 px-4 py-3">
          <span className="label-mono">{copy.sessions}</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={startNewSession}
              className="inline-flex h-7 items-center gap-1 rounded-[3px] border border-bone-100/12 px-2 font-mono text-[9.5px] uppercase tracking-[0.08em] text-bone-300 hover:border-brass-400/40 hover:text-bone-50"
            >
              <Plus className="h-3 w-3" />
              {copy.newSession}
            </button>
            <button
              type="button"
              onClick={() => setRailOpen(false)}
              className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-[3px] text-bone-400 lg:hidden"
              aria-label="Close sessions"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {sessions.length === 0 ? (
            <p className="px-2 py-4 text-[11.5px] leading-relaxed text-bone-500">
              {copy.noSessions}
            </p>
          ) : (
            <ul className="space-y-0.5">
              {sessions.map((session) => (
                <li key={session.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => openSession(session)}
                    className={cn(
                      "flex w-full items-start rounded-[4px] px-2.5 py-2 pr-8 text-left transition-colors",
                      session.id === sessionId
                        ? "bg-bone-100/[0.07] text-bone-100"
                        : "text-bone-300 hover:bg-bone-100/[0.04]",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1 text-[12px] leading-snug">
                        {session.title || "Untitled session"}
                      </span>
                      <span className="mt-1 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.08em] text-bone-500">
                        {relativeTime(session.updatedAt)}
                        <span className="h-0.5 w-0.5 rounded-full bg-bone-100/20" />
                        {session.messages.length} turns
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={(event) => removeSession(session.id, event)}
                    className="absolute right-1.5 top-1.5 hidden h-5 w-5 items-center justify-center rounded-[3px] text-bone-500 hover:bg-bone-100/5 hover:text-vermillion-400 group-hover:flex"
                    aria-label={`Delete ${session.title || "session"}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-bone-100/10 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-bone-500">
              Backend
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-bone-300">
              <span
                className={cn(
                  "h-1 w-1 rounded-full",
                  backendMode() === "supabase" ? "bg-emerald-400" : "bg-brass-400",
                )}
              />
              {backendLabel()}
            </span>
          </div>
          <p className="mt-2 text-[10.5px] leading-relaxed text-bone-500">
            {backendMode() === "supabase"
              ? "Sessions are stored in your Supabase account."
              : "Local mode — sessions stay in this browser."}
          </p>
        </div>
      </aside>

      {railOpen && (
        <div
          className="absolute inset-0 z-30 bg-ink-950/70 lg:hidden"
          onClick={() => setRailOpen(false)}
          aria-hidden
        />
      )}

      {/* ------------------------------ thread ------------------------------ */}
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-bone-100/10 px-4 py-2.5 md:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setRailOpen(true)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-[3px] text-bone-400 hover:bg-bone-100/5 hover:text-bone-100 lg:hidden"
              aria-label="Open sessions"
            >
              <PanelLeft className="h-3.5 w-3.5" />
            </button>
            <span className="label-mono hidden sm:inline">Console</span>
            <span className="hidden h-3 w-px bg-bone-100/15 sm:inline" />
            <span className="truncate text-[11.5px] text-bone-400">
              {truncate(
                messages.find((message) => message.role === "user")?.content ?? "New session",
                64,
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {ministry ? (
              <span className="hidden max-w-[180px] truncate rounded-[3px] border border-brass-500/30 bg-brass-500/10 px-1.5 py-1 font-mono text-[9px] uppercase tracking-[0.08em] text-brass-300 sm:inline">
                {ministry}
              </span>
            ) : null}
            <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-bone-500">
              top-k 6 · pgvector
            </span>
          </div>
        </div>

        <div
          ref={scrollRef}
          onScroll={(event) => {
            const node = event.currentTarget;
            stickRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80;
          }}
          className="min-h-0 flex-1 overflow-y-auto"
        >
          <div className="mx-auto w-full max-w-[760px] px-5 py-8 md:px-8">
            {showEmpty ? (
              <div className="animate-fade">
                <p className="label-mono">Session · new</p>
                <h1 className="mt-4 font-display text-[clamp(2rem,4vw,2.9rem)] leading-[1.03] text-bone-50">
                  {copy.emptyTitle}
                </h1>
                <p className="mt-3 max-w-[52ch] text-[13.5px] leading-relaxed text-bone-400">
                  {copy.emptyBody}
                </p>

                <div className="mt-9 grid gap-px overflow-hidden rounded-[5px] border border-bone-100/10 bg-bone-100/10 sm:grid-cols-2">
                  {copy.suggestions.map((suggestion, index) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => send(suggestion)}
                      className="group flex items-start gap-2.5 bg-ink-900 px-4 py-4 text-left transition-colors hover:bg-ink-850"
                    >
                      <span className="mt-[1px] font-mono text-[10px] text-brass-400/70">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span
                        className={cn(
                          "text-[12.5px] leading-relaxed text-bone-300 group-hover:text-bone-100",
                          locale === "ne" && "devanagari",
                        )}
                      >
                        {suggestion}
                      </span>
                    </button>
                  ))}
                </div>

                <p className="mt-8 max-w-[60ch] border-l border-brass-500/30 pl-3 font-mono text-[9.5px] leading-relaxed tracking-[0.04em] text-bone-500">
                  {copy.disclaimer}
                </p>
              </div>
            ) : (
              <div className="space-y-9">
                {messages.map((message) => (
                  <MessageBlock
                    key={message.id}
                    message={message}
                    streaming={streaming && message.id === activeAssistant?.id}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <KeyPanel
          open={keyOpen}
          onOpenChange={setKeyOpen}
          current={ownKey}
          onChange={(choice) => {
            setOwnKey(choice);
            if (choice) setQuotaHit(false);
          }}
          exhausted={quotaHit}
        />

        <Composer
          onSend={send}
          onStop={stop}
          streaming={streaming}
          locale={locale}
          onLocaleChange={setLocale}
          ministries={ministries}
          ministry={ministry}
          onMinistryChange={setMinistry}
        />
      </section>

      {/* ----------------------------- evidence ----------------------------- */}
      <EvidencePanel
        sources={activeAssistant?.sources ?? []}
        quality={activeAssistant?.qualityScore ?? null}
        latency={activeAssistant?.latencyMs ?? null}
        streaming={streaming}
        locale={locale}
      />
    </div>
  );
}
