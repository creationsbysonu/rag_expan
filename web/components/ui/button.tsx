import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-45 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-brass-400 select-none",
  {
    variants: {
      variant: {
        primary:
          "bg-bone-50 text-ink-950 hover:bg-brass-200 active:translate-y-px shadow-[0_1px_0_0_rgba(255,255,255,0.25)_inset]",
        brass:
          "bg-brass-400 text-ink-950 hover:bg-brass-300 active:translate-y-px shadow-[0_10px_30px_-12px_rgba(223,168,81,0.7)]",
        outline:
          "border border-bone-100/15 text-bone-100 hover:border-brass-400/50 hover:bg-bone-100/[0.04]",
        ghost: "text-bone-300 hover:text-bone-50 hover:bg-bone-100/[0.05]",
        danger: "bg-vermillion-500 text-bone-50 hover:bg-vermillion-400",
        link: "text-brass-300 underline underline-offset-4 hover:text-brass-200 p-0 h-auto",
      },
      size: {
        sm: "h-8 rounded-[4px] px-3 text-[12.5px]",
        md: "h-10 rounded-[5px] px-4 text-[13.5px]",
        lg: "h-12 rounded-[6px] px-6 text-[14.5px]",
        icon: "h-9 w-9 rounded-[5px]",
      },
    },
    defaultVariants: { variant: "outline", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";

export { buttonVariants };
