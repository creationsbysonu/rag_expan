import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Building2, Code2, Frame, MessageSquare } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { CodeBlock } from "@/components/ui/code-block";

export const metadata: Metadata = {
  title: "Integrate",
  description:
    "Embed the assistant in a bank portal, support desk or intranet: iframe widget, streaming API or server-side calls with citations.",
};

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://YOUR-PROJECT.supabase.co";
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "YOUR-PUBLISHABLE-KEY";
const CHAT_ENDPOINT = `${SUPABASE_URL}/functions/v1/chat`;
const EMBED_URL = `${SITE_URL}/embed`;

const modes = [
  {
    icon: Frame,
    title: "Drop-in widget",
    body: "One iframe. No build step, no npm, works inside any CMS, portal or legacy page.",
    detail: "Best for: bank intranets, ministry portals, static help pages.",
  },
  {
    icon: Code2,
    title: "Streaming API",
    body: "POST a question, read server-sent events: sources first, tokens as they arrive, a final score.",
    detail: "Best for: React/Next frontends, mobile apps, Flutter or WebView shells.",
  },
  {
    icon: Building2,
    title: "Server-side",
    body: "Call it from your backend so keys, prompts and PII handling stay on your side of the wall.",
    detail: "Best for: banking chatbots, IVR, WhatsApp and Viber bots.",
  },
];

export default function IntegratePage() {
  return (
    <>
      <div className="mx-auto max-w-[1240px] px-5 pt-14 md:px-8">
        <p className="label-mono">Integration</p>
        <div className="mt-6 grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
          <div>
            <h1 className="text-balance font-display text-[clamp(2.5rem,5.2vw,4.2rem)] leading-[0.97] tracking-[-0.02em] text-bone-50">
              Put the record
              <span className="block italic text-brass-300">inside your product.</span>
            </h1>
            <p className="mt-6 max-w-[56ch] text-[14px] leading-relaxed text-bone-300">
              A bank customer asking &ldquo;which documents do I need for a gold loan?&rdquo; should
              get the directive that answers it, not a guess. Every surface below streams the same
              grounded response, with the passage it came from attached.
            </p>
            <p className="mt-4 max-w-[56ch] text-[13px] leading-relaxed text-bone-500">
              Three integration depths, one endpoint. Start with the iframe; move to the API when
              you need your own chrome, your own logging or your own authentication.
            </p>
          </div>

          <div className="grid gap-px overflow-hidden rounded-[6px] border border-bone-100/10 bg-bone-100/10 self-start">
            {modes.map((mode) => (
              <div key={mode.title} className="bg-ink-900 px-5 py-5">
                <div className="flex items-center gap-2">
                  <mode.icon className="h-3.5 w-3.5 text-brass-300" />
                  <span className="text-[13px] text-bone-100">{mode.title}</span>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-bone-400">{mode.body}</p>
                <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.1em] text-bone-500">
                  {mode.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ------------------------------ widget ------------------------------ */}
      <section className="mx-auto max-w-[1240px] px-5 py-20 md:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr]">
          <div>
            <p className="label-mono">01 · Widget</p>
            <h2 className="mt-4 font-display text-[clamp(1.9rem,3.4vw,2.6rem)] leading-[1.05] text-bone-50">
              Paste an iframe.
            </h2>
            <p className="mt-4 max-w-[46ch] text-[13px] leading-relaxed text-bone-400">
              The widget is a separate route with no site chrome, so it inherits nothing from your
              page and cannot be broken by your CSS. Pass an accent colour to match your brand.
            </p>
            <p className="mt-4 text-[12.5px] text-bone-500">
              Live preview:{" "}
              <a
                href={EMBED_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-bone-200 underline decoration-bone-100/20 hover:text-brass-300"
              >
                open /embed <ArrowUpRight className="h-3 w-3" />
              </a>
            </p>
          </div>

          <div className="space-y-4">
            <CodeBlock
              title="inline iframe"
              code={`<iframe
  src="${EMBED_URL}?accent=%23dfa851"
  title="Public record assistant"
  style="width:100%;max-width:420px;height:620px;border:0;border-radius:12px"
  loading="lazy"
  allow="clipboard-write"
></iframe>`}
            />
            <CodeBlock
              title="floating bubble (any page)"
              code={`<script>
  (function () {
    var open = false;
    var frame = document.createElement("iframe");
    frame.src = "${EMBED_URL}";
    frame.title = "Public record assistant";
    frame.style.cssText =
      "position:fixed;right:24px;bottom:88px;width:380px;height:560px;border:0;" +
      "border-radius:14px;box-shadow:0 24px 60px rgba(0,0,0,.35);display:none;z-index:2147483000";
    var button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-label", "Ask the record");
    button.textContent = "Ask";
    button.style.cssText =
      "position:fixed;right:24px;bottom:24px;height:48px;padding:0 20px;border:0;border-radius:24px;" +
      "background:#dfa851;color:#070908;font:600 14px system-ui;cursor:pointer;z-index:2147483000";
    button.onclick = function () {
      open = !open;
      frame.style.display = open ? "block" : "none";
    };
    document.body.appendChild(frame);
    document.body.appendChild(button);
  })();
</script>`}
            />
            <p className="text-[11.5px] leading-relaxed text-bone-500">
              Nothing is loaded until you append it, so the snippet costs no requests on pages that
              never open the panel.
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------- api -------------------------------- */}
      <section className="border-y border-bone-100/10 bg-ink-900/30">
        <div className="mx-auto max-w-[1240px] px-5 py-20 md:px-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="label-mono">02 · Streaming API</p>
              <h2 className="mt-4 font-display text-[clamp(1.9rem,3.4vw,2.6rem)] leading-[1.05] text-bone-50">
                Sources, then tokens.
              </h2>
            </div>
            <p className="max-w-[46ch] text-[13px] leading-relaxed text-bone-400">
              Server-sent events. A <code className="text-bone-200">sources</code> frame arrives
              before the first token, so your UI can show the passage while the answer is still
              being written.
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <CodeBlock
              title="javascript · stream"
              code={`const res = await fetch("${CHAT_ENDPOINT}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    apikey: "${PUBLISHABLE_KEY}",
  },
  body: JSON.stringify({
    question: "Which documents are needed for a gold loan?",
    session_id: crypto.randomUUID(),
    language: "en",     // or "ne"
    ministry: null,     // optional filter, e.g. "Ministry of Finance"
    top_k: 6,
  }),
});

const reader = res.body.getReader();
const decoder = new TextDecoder();
let buffer = "";

while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });

  // SSE frames are separated by a blank line.
  const frames = buffer.split("\\n\\n");
  buffer = frames.pop();

  for (const frame of frames) {
    const line = frame.trim();
    if (!line.startsWith("data:")) continue;
    const event = JSON.parse(line.slice(5).trim());

    if (event.type === "sources") renderCitations(event.sources);
    if (event.type === "token") append(event.delta);
    if (event.type === "done") finish(event.quality_score, event.latency_ms);
    if (event.type === "error") fail(event.message);
  }
}`}
            />
            <CodeBlock
              title="python · banking chatbot"
              code={`import json
import uuid
import requests

CHAT_URL = "${CHAT_ENDPOINT}"
HEADERS = {"apikey": "${PUBLISHABLE_KEY}"}

def stream_answer(question: str, ministry: str | None = None):
    """Yield answer deltas; collect citations for the ticket log."""
    payload = {
        "question": question,
        "session_id": str(uuid.uuid4()),
        "language": "ne" if any("\\u0900" <= ch <= "\\u097f" for ch in question) else "en",
        "ministry": ministry,
        "top_k": 6,
    }
    sources = []
    with requests.post(CHAT_URL, json=payload, headers=HEADERS, stream=True, timeout=60) as r:
        r.raise_for_status()
        for raw in r.iter_lines(decode_unicode=True):
            if not raw or not raw.startswith("data:"):
                continue
            event = json.loads(raw[5:].strip())
            if event["type"] == "sources":
                sources = event["sources"]          # cite these in the ticket
            elif event["type"] == "token":
                yield event["delta"]                # push to your web socket
            elif event["type"] == "done":
                log_turn(question, event["text"], sources, event["quality_score"])
            elif event["type"] == "error":
                raise RuntimeError(event["message"])`}
            />
          </div>

          <div className="mt-8 grid gap-px overflow-hidden rounded-[6px] border border-bone-100/10 bg-bone-100/10 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["POST", "Profile creation is not required — the endpoint rate-limits per IP."],
              ["10 MB", "Question bodies are capped; answers stream unbounded."],
              ["30/min", "Default per-user rate limit (RATE_LIMIT_PER_MINUTE on the function)."],
              ["Apache-2.0", "No vendor lock: the schema and functions are in the repo."],
            ].map(([value, label]) => (
              <div key={value} className="bg-ink-900 px-5 py-4">
                <p className="font-mono text-[15px] text-brass-300">{value}</p>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-bone-400">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------ ingest ------------------------------ */}
      <section className="mx-auto max-w-[1240px] px-5 py-20 md:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr]">
          <div>
            <p className="label-mono">03 · Feeding it</p>
            <h2 className="mt-4 font-display text-[clamp(1.9rem,3.4vw,2.6rem)] leading-[1.05] text-bone-50">
              Your documents, your corpus.
            </h2>
            <p className="mt-4 max-w-[46ch] text-[13px] leading-relaxed text-bone-400">
              A bank can keep an internal corpus — circulars, product manuals, KYC rules — and a
              public one side by side. Upload from{" "}
              <Link href="/upload" className="text-bone-200 underline decoration-bone-100/20">
                /upload
              </Link>{" "}
              or push files automatically from a nightly job.
            </p>
          </div>
          <div className="space-y-4">
            <CodeBlock
              title="shell · scheduled ingest"
              code={`curl -X POST "${SUPABASE_URL}/functions/v1/ingest" \\
  -H "x-ingest-secret: $INGEST_SECRET" \\
  -F "file=@circulars/2081-14.pdf" \\
  -F "title=Gold loan collateral directive" \\
  -F "ministry=Ministry of Finance" \\
  -F "published_at=2024-06-11" \\
  -F "source_url=https://example.gov.np/notices/2081-14"`}
            />
            <p className="text-[11.5px] leading-relaxed text-bone-500">
              Returns the document id, chunk count and page count. Passages are searchable the
              moment the response lands — no rebuild, no retraining.
            </p>
          </div>
        </div>

        <div className="mt-16 flex flex-wrap items-center justify-between gap-6 border-t border-bone-100/10 pt-10">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-4 w-4 text-brass-300" />
            <p className="max-w-[48ch] font-display text-[clamp(1.5rem,2.6vw,2rem)] leading-tight text-bone-100">
              If it is not in the corpus, the answer says so.
            </p>
          </div>
          <Link
            href="/chat"
            className="inline-flex h-11 items-center gap-2 rounded-[5px] bg-bone-50 px-5 text-[13.5px] font-medium text-ink-950 hover:bg-brass-200"
          >
            Try the console
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
