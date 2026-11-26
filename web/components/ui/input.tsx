import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-[4px] border border-bone-100/12 bg-ink-900/80 px-3 text-[13.5px] text-bone-100 placeholder:text-bone-500 transition-colors",
        "hover:border-bone-100/20 focus:border-brass-400/60 focus:outline-none focus:ring-1 focus:ring-brass-400/20",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full resize-none rounded-[4px] border border-bone-100/12 bg-ink-900/80 px-3 py-2.5 text-[13.5px] text-bone-100 placeholder:text-bone-500 transition-colors",
        "hover:border-bone-100/20 focus:border-brass-400/60 focus:outline-none focus:ring-1 focus:ring-brass-400/20",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-9 rounded-[4px] border border-bone-100/12 bg-ink-900 px-2.5 text-[12.5px] text-bone-200 transition-colors",
        "hover:border-bone-100/20 focus:border-brass-400/60 focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}
