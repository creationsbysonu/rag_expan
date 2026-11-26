import type { Metadata } from "next";
import { CorpusBrowser } from "@/components/documents/corpus-browser";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Corpus",
  description: "Browse every document in the index, with ministry, notice and passage counts.",
};

export default function DocumentsPage() {
  return (
    <>
      <div className="mx-auto max-w-[1240px] px-5 pb-8 pt-14 md:px-8">
        <p className="label-mono">Index · documents</p>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-6">
          <h1 className="max-w-[20ch] font-display text-[clamp(2.4rem,5vw,3.8rem)] leading-[0.98] tracking-[-0.02em] text-bone-50">
            The corpus, <span className="italic text-brass-300">in full.</span>
          </h1>
          <p className="max-w-[42ch] text-[13px] leading-relaxed text-bone-400">
            Everything the assistant may cite. If a document is not here, the assistant will not
            claim to know it.
          </p>
        </div>

        <div className="mt-12">
          <CorpusBrowser />
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
