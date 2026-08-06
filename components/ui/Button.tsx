"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "sm";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const base =
  "focus-ring inline-flex items-center justify-center gap-2 rounded-ctl font-semibold transition-all duration-150 select-none disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary:
    "gradient-button-depth text-white hover:bg-primary-hover hover:shadow-md hover:-translate-y-px active:translate-y-0 active:scale-[0.98]",
  secondary:
    "bg-surface border border-border text-ink hover:border-primary-border hover:shadow-md active:scale-[0.98]",
  ghost:
    "bg-transparent text-primary hover:bg-primary-soft active:scale-[0.98]",
  danger:
    "bg-danger text-white hover:opacity-90 active:scale-[0.98]",
};

const sizes: Record<Size, string> = {
  md: "h-10 px-4 text-[15px]",
  sm: "h-8 px-3 text-[13px]",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className, variant = "primary", size = "md", loading, children, disabled, ...props },
    ref
  ) {
    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {children}
      </button>
    );
  }
);
