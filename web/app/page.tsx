import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpenCheck,
  Braces,
  Compass,
  Fingerprint,
  Globe2,
  Landmark,
  Quote,
  Scale,
  ScanSearch,
  Waypoints,
} from "lucide-react";
import { HeroConsole } from "@/components/landing/hero-console";
import { CorpusTicker } from "@/components/landing/corpus-ticker";
import { MinistryMarquee } from "@/components/landing/ministry-marquee";
import { SiteFooter } from "@/components/site-footer";

const steps = [
  {
    n: "01",
    title: "Retrieve",
    body: "The question is embedded in semantic space and matched against every indexed passage with pgvector. Ministry and document filters narrow the field before ranking.",
    icon: ScanSearch,
  },
  {
    n: "02",
    title: "Ground",
    body: "Only the top passages reach the language model, with instructions to answer from that context or refuse. Nothing outside the corpus is treated as evidence.",
    icon: Landmark,
  },
  {
    n: "03",
    title: "Cite",
    body: "Each claim is returned alongside the exact passage, page hint and notice identifier, so a reader can open the source record and check the wording.",
    icon: Quote,
  },
];

const capabilities = [
  {
    title: "Refusal by default",
    body: "If the corpus does not support an answer, the system says so instead of improvising.",
    icon: Scale,
  },
  {
    title: "Devanagari-native",
    body: "Nepali queries are answered in Nepali. Transliteration, not translation, bridges the two.",
    icon: Globe2,
  },
  {
    title: "Passage-level provenance",
    body: "Source cards carry notice IDs, ministry, service and page hints for deep links.",
    icon: Fingerprint,
  },
  {
    title: "Streamed responses",
    body: "Tokens arrive as they are generated, with retrieval and grounding metadata attached.",
    icon: Waypoints,
  },
  {
    title: "Private by construction",
    body: "Conversations live in Postgres under row-level security. Sessions are yours alone.",
    icon: Braces,
  },
  {
    title: "Measured, not asserted",
    body: "Every answer is scored for grounding; signals show latency, quality and demand.",
    icon: Compass,
  },
];

export default function HomePage() {
  return (
    <>
      {/* ------------------------------- hero ------------------------------- */}
      <section className="grain-overlay relative overflow-hidden">
        <div className="aurora absolute inset-0 -z-10 opacity-70" aria-hidden />
        <div className="rule-grid absolute inset-0 -z-10 opacity-[0.35]" aria-hidden />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-b from-transparent to-ink-950" aria-hidden />

        <div className="mx-auto max-w-[1240px] px-5 pb-20 pt-14 md:px-8 md:pb-28 md:pt-20">
          <div className="flex items-center gap-3">
            <span className="h-px w-10 bg-brass-500/70" />
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-brass-300">
              Nepal · Public record index · 2082
            </p>
          </div>

          <div className="mt-10 grid items-start gap-14 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
            <div className="animate-rise">
              <h1 className="text-balance font-display text-[clamp(2.9rem,6.4vw,5.2rem)] leading-[0.94] tracking-[-0.02em] text-bone-50">
                Every answer,
                <br />
                <span className="italic text-brass-300">traceable</span> to the
                <br />
                gazette.
              </h1>

              <p className="devanagari mt-6 text-[16px] leading-relaxed text-bone-300">
                सरकारी सूचना, ऐन र प्रक्रियाबारे सोध्नुहोस् — हरेक उत्तरको स्रोतसहित।
              </p>

              <p className="mt-5 max-w-[46ch] text-pretty text-[14.5px] leading-relaxed text-bone-400">
                A retrieval system built for the long tail of administrative questions. It reads
                notices, directives and constitutional text — then answers only from what it can
                point to.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link
                  href="/chat"
                  className="group inline-flex h-12 items-center gap-2 rounded-[5px] bg-bone-50 px-6 text-[14px] font-medium text-ink-950 transition-colors hover:bg-brass-200"
                >
                  Ask the record
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/documents"
                  className="inline-flex h-12 items-center gap-2 rounded-[5px] border border-bone-100/15 px-5 text-[14px] text-bone-200 transition-colors hover:border-brass-400/50 hover:text-bone-50"
                >
                  <BookOpenCheck className="h-4 w-4" />
                  Browse corpus
                </Link>
              </div>

              <dl className="mt-12 grid max-w-[440px] grid-cols-3 gap-6 border-t border-bone-100/10 pt-6">
                {[
                  ["Cited", "every claim"],
                  ["Bilingual", "ne · en"],
                  ["Auditable", "open schema"],
                ].map(([term, detail]) => (
                  <div key={term}>
                    <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-bone-500">
                      {detail}
                    </dt>
                    <dd className="mt-1.5 font-display text-[19px] text-bone-100">{term}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="animate-rise lg:sticky lg:top-24" style={{ animationDelay: "120ms" }}>
              <HeroConsole />
            </div>
          </div>
        </div>
      </section>

      <CorpusTicker />

      {/* ---------------------------- how it reads --------------------------- */}
      <section className="mx-auto max-w-[1240px] px-5 py-24 md:px-8 md:py-32">
        <div className="grid gap-8 md:grid-cols-[0.9fr_1.1fr] md:items-end">
          <div>
            <p className="label-mono">Method · 01—03</p>
            <h2 className="mt-4 text-balance font-display text-[clamp(2.1rem,4vw,3.2rem)] leading-[1.02] tracking-[-0.015em] text-bone-50">
              Retrieval before rhetoric.
            </h2>
          </div>
          <p className="max-w-[52ch] text-pretty text-[13.5px] leading-relaxed text-bone-400 md:justify-self-end">
            The architecture is deliberately boring: embed the question, retrieve the best
            passages, constrain the model, expose the evidence. Every design decision serves one
            property — a reader can verify the sentence they just read.
          </p>
        </div>

        <div className="mt-16 grid gap-px overflow-hidden rounded-[6px] border border-bone-100/10 bg-bone-100/10 md:grid-cols-3">
          {steps.map((step) => (
            <article key={step.n} className="group relative bg-ink-900 p-7 transition-colors hover:bg-ink-850">
              <div className="flex items-start justify-between">
                <span className="font-display text-[38px] leading-none text-brass-500/60 transition-colors group-hover:text-brass-400">
                  {step.n}
                </span>
                <step.icon className="h-4 w-4 text-bone-500" strokeWidth={1.5} />
              </div>
              <h3 className="mt-7 text-[15px] font-medium text-bone-50">{step.title}</h3>
              <p className="mt-2.5 text-[13px] leading-relaxed text-bone-400">{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ---------------------------- bilingual ----------------------------- */}
      <section className="border-y border-bone-100/10 bg-ink-900/30">
        <div className="mx-auto max-w-[1240px] px-5 py-24 md:px-8">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <div>
              <p className="label-mono">Bilingual by design</p>
              <h2 className="mt-4 font-display text-[clamp(2rem,3.6vw,2.9rem)] leading-[1.05] text-bone-50">
                The question arrives in Nepali.
                <span className="block italic text-brass-300">It stays in Nepali.</span>
              </h2>
              <p className="mt-5 max-w-[42ch] text-[13.5px] leading-relaxed text-bone-400">
                Devanagari is not a translation layer bolted onto an English system. Queries are
                normalised, transliterated where the corpus demands it, and embedded with a
                multilingual model trained across both scripts.
              </p>
              <Link
                href="/about"
                className="mt-7 inline-flex items-center gap-1.5 text-[13px] text-brass-300 hover:text-brass-200"
              >
                Read the method note
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid gap-px overflow-hidden rounded-[6px] border border-bone-100/10 bg-bone-100/10 sm:grid-cols-2">
              <div className="bg-ink-950/60 p-6">
                <p className="label-mono">नेपाली</p>
                <p className="devanagari mt-4 text-[14.5px] leading-relaxed text-bone-100">
                  राहदानी नवीकरणका लागि के कागजात चाहिन्छ?
                </p>
                <div className="mt-6 border-l border-brass-500/40 pl-4">
                  <p className="devanagari text-[13px] leading-relaxed text-bone-300">
                    राहदानी नवीकरणका लागि पुरानो राहदानी, राष्ट्रिय परिचयपत्रको प्रतिलिपि र
                    निर्धारित दस्तुर आवश्यक पर्दछ।
                    <span className="ml-1 align-super font-mono text-[9px] text-brass-400">[2]</span>
                  </p>
                </div>
                <p className="mt-6 font-mono text-[9.5px] uppercase tracking-[0.14em] text-bone-500">
                  Source · Department of Passports
                </p>
              </div>
              <div className="bg-ink-950/60 p-6">
                <p className="label-mono">English</p>
                <p className="mt-4 text-[14.5px] leading-relaxed text-bone-100">
                  Which documents are required to renew a passport?
                </p>
                <div className="mt-6 border-l border-brass-500/40 pl-4">
                  <p className="text-[13px] leading-relaxed text-bone-300">
                    A renewal requires the previous passport, a copy of the national identity card
                    and the prescribed fee.
                    <span className="ml-1 align-super font-mono text-[9px] text-brass-400">[2]</span>
                  </p>
                </div>
                <p className="mt-6 font-mono text-[9.5px] uppercase tracking-[0.14em] text-bone-500">
                  Source · Department of Passports
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------- capabilities --------------------------- */}
      <section className="mx-auto max-w-[1240px] px-5 py-24 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="label-mono">System</p>
            <h2 className="mt-4 font-display text-[clamp(2rem,3.6vw,2.9rem)] leading-[1.05] text-bone-50">
              Built to be checked.
            </h2>
          </div>
          <p className="max-w-[38ch] text-[13px] leading-relaxed text-bone-400">
            Six properties that separate a citation engine from a chatbot with a search bar.
          </p>
        </div>

        <div className="mt-12 grid gap-px overflow-hidden rounded-[6px] border border-bone-100/10 bg-bone-100/10 sm:grid-cols-2 lg:grid-cols-3">
          {capabilities.map((capability, index) => (
            <article key={capability.title} className="group bg-ink-900 p-6 transition-colors hover:bg-ink-850">
              <div className="flex items-center justify-between">
                <capability.icon className="h-4 w-4 text-brass-400/80" strokeWidth={1.5} />
                <span className="font-mono text-[10px] text-bone-500">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="mt-6 text-[14px] font-medium text-bone-50">{capability.title}</h3>
              <p className="mt-2 text-[12.5px] leading-relaxed text-bone-400">{capability.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ---------------------------- ministries ---------------------------- */}
      <section className="pb-8">
        <div className="mx-auto mb-6 max-w-[1240px] px-5 md:px-8">
          <p className="label-mono">Currently indexed</p>
        </div>
        <MinistryMarquee />
      </section>

      {/* ------------------------------- cta -------------------------------- */}
      <section className="mx-auto max-w-[1240px] px-5 py-24 md:px-8">
        <div className="grain-overlay relative overflow-hidden rounded-[8px] border border-bone-100/10 bg-ink-900 px-6 py-14 md:px-14 md:py-20">
          <div className="aurora absolute inset-0 -z-10 opacity-50" aria-hidden />
          <div className="relative max-w-[62ch]">
            <p className="label-mono">Begin</p>
            <h2 className="mt-5 text-balance font-display text-[clamp(2.2rem,4.4vw,3.6rem)] leading-[1.02] tracking-[-0.015em] text-bone-50">
              Ask something specific.
              <span className="block italic text-brass-300">Get something checkable.</span>
            </h2>
            <p className="mt-5 text-[13.5px] leading-relaxed text-bone-400">
              No account needed to ask. Sign in when you want your sessions to persist across
              devices.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/chat"
                className="group inline-flex h-12 items-center gap-2 rounded-[5px] bg-brass-400 px-6 text-[14px] font-medium text-ink-950 transition-colors hover:bg-brass-300"
              >
                Open the console
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex h-12 items-center rounded-[5px] border border-bone-100/15 px-5 text-[14px] text-bone-200 transition-colors hover:border-brass-400/50"
              >
                See the signals
              </Link>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
