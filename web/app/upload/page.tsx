import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { UploadConsole } from "@/components/documents/upload-console";

export const metadata: Metadata = {
  title: "Upload",
  description:
    "Publish a document to the corpus: extract text, chunk it, embed it and make it citable.",
  robots: { index: false, follow: false },
};

export default function UploadPage() {
  return (
    <>
      <div className="mx-auto max-w-[1240px] px-5 pt-14 md:px-8">
        <p className="label-mono">Corpus · ingest</p>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-6">
          <h1 className="max-w-[24ch] font-display text-[clamp(2.4rem,5vw,3.8rem)] leading-[0.98] tracking-[-0.02em] text-bone-50">
            Publish a document, <span className="italic text-brass-300">make it citable.</span>
          </h1>
          <p className="max-w-[42ch] text-[13px] leading-relaxed text-bone-400">
            Text is extracted, chunked and embedded in one pass. When it finishes, the assistant
            can cite it — no redeploy, no reindex.
          </p>
        </div>

        <div className="mt-12 pb-4">
          <UploadConsole />
        </div>

        <p className="pb-16 text-[11.5px] text-bone-500">
          Uploading from a script instead?{" "}
          <Link href="/integrate" className="text-bone-300 underline decoration-bone-100/20">
            Use the ingest API
          </Link>
          .
        </p>
      </div>
      <SiteFooter />
    </>
  );
}
