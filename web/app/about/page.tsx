import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Github } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Method",
  description:
    "How the retrieval system works: chunking, multilingual embeddings, pgvector search, grounded generation and citation policy.",
  authors: [{ name: "Sonu Kumar Gupta", url: "https://github.com/creationsbysonu" }],
};

const stack = [
  ["Delivery", "Next.js App Router on Vercel, streamed over the edge network"],
  ["Data", "Supabase Postgres + pgvector, row-level security on every user table"],
  ["Backend", "Supabase Edge Function (Deno) — retrieval, generation, logging"],
  ["Embeddings", "768-dimension multilingual vectors, cosine distance, HNSW index"],
  ["Generation", "Gemini 2.5 Flash, temperature 0.25, context-constrained prompts"],
  ["Observability", "Per-answer grounding scores, latency and citation counts in Postgres"],
];

const faqs = [
  {
    q: "Does the model answer from its own knowledge?",
    a: "No. The prompt constrains generation to the retrieved passages and instructs an explicit refusal when they do not contain the answer. A grounding score is computed and shown on every response.",
  },
  {
    q: "How are Nepali questions handled?",
    a: "Queries are language-detected, normalised and (where useful) transliterated before embedding. The multilingual embedding space places Devanagari and Latin script queries close together, so a Nepali question can retrieve an English notice and vice versa.",
  },
  {
    q: "What counts as a source?",
    a: "A passage from an indexed document, carrying its notice identifier, ministry, page hint and a similarity score. Nothing else is presented as evidence — no web results, no model recall.",
  },
  {
    q: "How current is the corpus?",
    a: "Ingestion is manual and auditable. The corpus page shows the latest publication dates; the landing page shows the last successful ingest.",
  },
];

export default function AboutPage() {
  return (
    <>
      <div className="mx-auto max-w-[1240px] px-5 pt-14 md:px-8">
        <p className="label-mono">Method note</p>

        <div className="mt-6 grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
          <div>
            <h1 className="text-balance font-display text-[clamp(2.6rem,5.4vw,4.4rem)] leading-[0.96] tracking-[-0.02em] text-bone-50">
              A citation engine,
              <span className="block italic text-brass-300">not an oracle.</span>
            </h1>
            <p className="devanagari mt-6 text-[15px] leading-relaxed text-bone-300">
              यो प्रणाली सरकारी कागजातमा आधारित छ। हरेक उत्तरको स्रोत देखाइन्छ।
            </p>
            <p className="mt-6 max-w-[58ch] text-[14px] leading-relaxed text-bone-300">
              Public administration is a long-tail problem. The question a citizen actually has —
              which office stamps which form, which directive supersedes which circular — rarely
              appears in a FAQ. It appears on page nine of a notice, in Nepali, published three
              years ago.
            </p>
            <p className="mt-4 max-w-[58ch] text-[14px] leading-relaxed text-bone-400">
              This system is built around retrieval rather than recall. The model is not asked to
              remember policy; it is asked to read what was retrieved and attribute it. That single
              constraint shapes the chunking, the prompt, the interface and the metrics.
            </p>
          </div>

          <div className="panel self-start">
            <div className="border-b border-bone-100/8 px-5 py-3">
              <span className="label-mono">Stack</span>
            </div>
            <dl className="divide-y divide-bone-100/8">
              {stack.map(([term, detail]) => (
                <div key={term} className="grid grid-cols-[110px_1fr] gap-4 px-5 py-3.5">
                  <dt className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-bone-500">
                    {term}
                  </dt>
                  <dd className="text-[12.5px] leading-relaxed text-bone-300">{detail}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      <section id="sources" className="mx-auto max-w-[1240px] px-5 py-24 md:px-8">
        <div className="grid gap-px overflow-hidden rounded-[6px] border border-bone-100/10 bg-bone-100/10 md:grid-cols-2">
          {faqs.map((faq) => (
            <article key={faq.q} className="bg-ink-900 px-6 py-7">
              <h2 className="font-display text-[21px] leading-tight text-bone-50">{faq.q}</h2>
              <p className="mt-3 text-[13px] leading-relaxed text-bone-400">{faq.a}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="limits" className="border-y border-bone-100/10 bg-ink-900/30">
        <div className="mx-auto max-w-[1240px] px-5 py-20 md:px-8">
          <div className="grid gap-10 md:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="label-mono">Known limits</p>
              <h2 className="mt-4 font-display text-[clamp(1.9rem,3.4vw,2.7rem)] leading-[1.05] text-bone-50">
                Where this fails.
              </h2>
            </div>
            <ul className="space-y-4 text-[13px] leading-relaxed text-bone-400">
              <li className="border-l border-bone-100/15 pl-4">
                <span className="text-bone-200">Coverage is not completeness.</span> A document
                missing from the index is invisible to the assistant, and absence of evidence should
                never be read as evidence of absence.
              </li>
              <li className="border-l border-bone-100/15 pl-4">
                <span className="text-bone-200">OCR noise survives.</span> Scanned gazettes produce
                imperfect text; numeric tables and schedules are the least reliable passages.
              </li>
              <li className="border-l border-bone-100/15 pl-4">
                <span className="text-bone-200">Grounding is heuristic.</span> The score measures
                lexical and semantic support, not legal correctness. It is a signal, not a
                certificate.
              </li>
              <li className="border-l border-bone-100/15 pl-4">
                <span className="text-bone-200">Not legal advice.</span> Verify against the original
                publication before acting on any answer.
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="border-b border-bone-100/10">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-6 px-5 py-14 md:flex-row md:items-center md:justify-between md:px-8">
          <div className="flex items-center gap-5">
            <Image
              src="/sonu-kumar-gupta.jpg"
              alt="Sonu Kumar Gupta"
              width={72}
              height={72}
              className="h-[72px] w-[72px] rounded-full border border-bone-100/15 object-cover"
            />
            <div>
              <p className="label-mono">Built &amp; maintained by</p>
              <p className="mt-2 font-display text-[22px] leading-none text-bone-50">
                Sonu Kumar Gupta
              </p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-bone-400">
                Retrieval design, ingestion pipeline and the interface you are reading.
              </p>
            </div>
          </div>
          <a
            href="https://github.com/creationsbysonu"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 w-fit items-center gap-2 rounded-[5px] border border-bone-100/20 px-4 text-[12.5px] text-bone-200 transition-colors hover:border-brass-400/50 hover:text-brass-300"
          >
            <Github className="h-3.5 w-3.5" />
            github.com/creationsbysonu
          </a>
        </div>
      </section>

      <div className="mx-auto max-w-[1240px] px-5 py-20 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <p className="max-w-[46ch] font-display text-[clamp(1.7rem,3vw,2.3rem)] leading-tight text-bone-100">
            Curious whether an answer holds up? Ask it, then open the passage.
          </p>
          <Link
            href="/chat"
            className="group inline-flex h-11 items-center gap-2 rounded-[5px] bg-bone-50 px-5 text-[13.5px] font-medium text-ink-950 hover:bg-brass-200"
          >
            Open the console
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>

      <SiteFooter />
    </>
  );
}
