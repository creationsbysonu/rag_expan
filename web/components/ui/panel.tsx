import * as React from "react";
import { cn } from "@/lib/utils";

export function Panel({
  className,
  as: Tag = "div",
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: React.ElementType }) {
  return <Tag className={cn("panel rounded-[6px]", className)} {...props} />;
}

export function PanelHeader({
  title,
  meta,
  action,
  className,
}: {
  title: React.ReactNode;
  meta?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b border-bone-100/8 px-4 py-3",
        className,
      )}
    >
      <div className="flex min-w-0 items-baseline gap-3">
        <span className="label-mono">{title}</span>
        {meta ? <span className="truncate font-mono text-[10px] text-bone-500">{meta}</span> : null}
      </div>
      {action}
    </div>
  );
}
