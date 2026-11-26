import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-[720px] flex-col justify-center px-5">
      <p className="label-mono">Error 404</p>
      <h1 className="mt-4 font-display text-5xl leading-none text-bone-50">Not in the record.</h1>
      <p className="mt-4 max-w-[46ch] text-[14px] leading-relaxed text-bone-400">
        This page does not exist. It may have been moved, or it was never part of the index.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/"
          className="inline-flex h-10 items-center rounded-[4px] bg-bone-50 px-4 text-[13px] font-medium text-ink-950 hover:bg-brass-200"
        >
          Return home
        </Link>
        <Link
          href="/chat"
          className="inline-flex h-10 items-center rounded-[4px] border border-bone-100/15 px-4 text-[13px] text-bone-200 hover:border-brass-400/50"
        >
          Ask a question
        </Link>
      </div>
    </div>
  );
}
