import { cn } from "@/lib/utils";

/**
 * Abhilekh mark: an index spine with three record rules, the shortest one
 * ending in a brass seal. Reads as a ledger at 16px and as a citation at 32px.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("h-7 w-7 shrink-0", className)}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="abhilekh-spine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f0d29a" />
          <stop offset="1" stopColor="#c99a4e" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="7" fill="#0a0d0b" />
      <rect
        x="0.5"
        y="0.5"
        width="31"
        height="31"
        rx="6.5"
        fill="none"
        stroke="#dfa851"
        strokeOpacity="0.22"
      />
      <rect x="8.3" y="8" width="2.4" height="16" rx="1.2" fill="url(#abhilekh-spine)" />
      <rect x="13.4" y="9.1" width="10.3" height="1.7" rx="0.85" fill="#ece7db" fillOpacity="0.88" />
      <rect x="13.4" y="13.4" width="10.3" height="1.7" rx="0.85" fill="#ece7db" fillOpacity="0.62" />
      <rect x="13.4" y="17.7" width="6.2" height="1.7" rx="0.85" fill="#ece7db" fillOpacity="0.38" />
      <circle cx="22.2" cy="18.55" r="1.75" fill="#e8c07a" />
    </svg>
  );
}

/** Wordmark: the mark, Devanagari अभिलेख, and a mono latin label. */
export function Wordmark({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandMark />
      <span className="flex flex-col leading-none">
        <span className="devanagari text-[15px] font-semibold tracking-[0.02em] text-bone-50">
          अभिलेख
        </span>
        {!compact && (
          <span className="mt-[3px] font-mono text-[9px] uppercase tracking-[0.28em] text-bone-500">
            Public&nbsp;Record
          </span>
        )}
      </span>
    </span>
  );
}
