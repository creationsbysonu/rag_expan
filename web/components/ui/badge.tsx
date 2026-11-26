import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-[3px] border px-2 py-[3px] font-mono text-[10px] uppercase tracking-[0.12em] leading-none",
  {
    variants: {
      tone: {
        neutral: "border-bone-100/12 text-bone-400",
        brass: "border-brass-500/35 bg-brass-500/10 text-brass-300",
        green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
        red: "border-vermillion-500/40 bg-vermillion-500/10 text-vermillion-400",
        ink: "border-bone-100/10 bg-bone-100/[0.05] text-bone-200",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-[3px] bg-ink-800/60", className)} />;
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-[3px] border border-bone-100/15 bg-ink-800 px-1.5 py-[2px] font-mono text-[10px] text-bone-400">
      {children}
    </kbd>
  );
}
