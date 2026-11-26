import { cn } from "@/lib/utils";

/** Wordmark: brass rule + Devanagari "सरकार" over a mono latin label. */
export function Wordmark({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="relative flex h-7 w-7 items-center justify-center">
        <span className="absolute inset-0 rounded-[3px] border border-brass-500/40" />
        <span className="absolute left-1/2 top-1/2 h-3.5 w-px -translate-x-1/2 -translate-y-1/2 bg-brass-400" />
        <span className="absolute left-1/2 top-1/2 h-px w-3.5 -translate-x-1/2 -translate-y-1/2 bg-brass-400" />
        <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brass-300" />
      </span>
      <span className="flex flex-col leading-none">
        <span className="devanagari text-[15px] font-semibold tracking-[0.02em] text-bone-50">
          सरकार
        </span>
        {!compact && (
          <span className="mt-[3px] font-mono text-[9px] uppercase tracking-[0.28em] text-bone-500">
            Record&nbsp;Index
          </span>
        )}
      </span>
    </span>
  );
}
