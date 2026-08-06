"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input({ className, label, error, hint, id, ...props }, ref) {
    const autoId = React.useId();
    const inputId = id ?? autoId;
    return (
      <div className="flex w-full flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-small font-medium text-ink">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={cn(
            "h-10 w-full rounded-ctl border bg-surface px-3 text-[15px] text-ink placeholder:text-ink-3 transition-all duration-150",
            "focus:outline-none focus:ring-2 focus:ring-primary-soft focus:border-primary",
            error ? "border-danger" : "border-border",
            "disabled:opacity-50 disabled:bg-bg-subtle",
            className
          )}
          {...props}
        />
        {error ? (
          <p id={`${inputId}-error`} className="text-small text-danger">
            {error}
          </p>
        ) : hint ? (
          <p className="text-small text-ink-2">{hint}</p>
        ) : null}
      </div>
    );
  }
);
