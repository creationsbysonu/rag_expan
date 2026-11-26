import type { Metadata } from "next";
import { Signals } from "@/components/dashboard/signals";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Signals",
  description: "Retrieval quality, latency, language mix and citation demand across the corpus.",
};

export default function DashboardPage() {
  return (
    <>
      <div className="mx-auto max-w-[1240px] px-5 pb-10 pt-14 md:px-8">
        <p className="label-mono">Signals · operations</p>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-6">
          <h1 className="max-w-[22ch] font-display text-[clamp(2.4rem,5vw,3.8rem)] leading-[0.98] tracking-[-0.02em] text-bone-50">
            What the record is <span className="italic text-brass-300">being asked.</span>
          </h1>
          <p className="max-w-[40ch] text-[13px] leading-relaxed text-bone-400">
            Every answer is scored for grounding and logged. These are the operational signals, not
            vanity metrics.
          </p>
        </div>

        <div className="mt-12">
          <Signals />
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
