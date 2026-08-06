import * as React from "react";
import { cn } from "@/lib/cn";
import { Check } from "lucide-react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  clickable?: boolean;
  selected?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, clickable, selected, children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(
        "relative rounded-card border bg-surface p-5 shadow-xs transition-all duration-150",
        selected
          ? "border-primary-border bg-primary-soft"
          : "border-border",
        clickable &&
          "cursor-pointer hover:border-primary-border hover:shadow-md focus-ring",
        className
      )}
      {...(clickable ? { tabIndex: 0, role: "button" } : {})}
      {...props}
    >
      {selected && (
        <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-primary text-white check-pop">
          <Check className="size-3" aria-hidden />
        </span>
      )}
      {children}
    </div>
  );
});
