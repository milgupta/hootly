"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export type OllieMode = "idle" | "thinking" | "success" | "concerned";

/**
 * Full-body animated Ollie (docs/05 §12): round body 1:1.15 w:h, cream #FFF9F2,
 * purple wing ovals, brow tufts, orange beak, stubby feet, 2px ink outline.
 * Modes: idle (blink 6–10s), thinking (head tilt 8° + dots), success (wing flap +
 * 2 sparkles, one-shot), concerned (brows angle in). CSS-driven, ≤400ms per beat,
 * reduced-motion safe (globals.css). Max in-app render 96px; one Ollie per screen.
 */
export function OllieAnimated({
  mode = "idle",
  size = 96,
  className,
}: {
  mode?: OllieMode;
  size?: number;
  className?: string;
}) {
  const w = size;
  const h = Math.round(size * 1.15);
  return (
    <div className={cn("relative inline-block", className)} style={{ width: w, height: h }}>
      {mode === "thinking" && (
        <div className="absolute -top-4 left-1/2 flex -translate-x-1/2 gap-1" aria-hidden>
          <span className="ollie-dot size-1.5 rounded-full bg-primary" />
          <span className="ollie-dot size-1.5 rounded-full bg-primary" />
          <span className="ollie-dot size-1.5 rounded-full bg-primary" />
        </div>
      )}
      {mode === "success" && (
        <>
          <svg className="ollie-sparkle absolute -right-1 -top-2" width="14" height="14" viewBox="0 0 14 14" aria-hidden>
            <path d="M7 0 L8.4 5.6 L14 7 L8.4 8.4 L7 14 L5.6 8.4 L0 7 L5.6 5.6 Z" fill="#7C3AED" />
          </svg>
          <svg className="ollie-sparkle absolute -left-2 top-3" style={{ animationDelay: "120ms" }} width="10" height="10" viewBox="0 0 14 14" aria-hidden>
            <path d="M7 0 L8.4 5.6 L14 7 L8.4 8.4 L7 14 L5.6 8.4 L0 7 L5.6 5.6 Z" fill="#7C3AED" />
          </svg>
        </>
      )}
      <svg
        width={w}
        height={h}
        viewBox="0 0 80 92"
        role="img"
        aria-label={`Ollie the owl${mode !== "idle" ? ` (${mode})` : ""}`}
        className={cn(mode === "thinking" && "ollie-thinking")}
      >
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* feet */}
          <path d="M30 86 q2 5 6 0" fill="none" stroke="#17171C" strokeWidth="2" />
          <path d="M44 86 q2 5 6 0" fill="none" stroke="#17171C" strokeWidth="2" />
          {/* brow tufts */}
          {mode === "concerned" ? (
            <>
              <path d="M24 14 L32 8 L33 17 Z" fill="#7C3AED" stroke="#17171C" strokeWidth="2" />
              <path d="M56 14 L48 8 L47 17 Z" fill="#7C3AED" stroke="#17171C" strokeWidth="2" />
            </>
          ) : (
            <>
              <path d="M25 14 L30 5 L35 15 Z" fill="#7C3AED" stroke="#17171C" strokeWidth="2" />
              <path d="M55 14 L50 5 L45 15 Z" fill="#7C3AED" stroke="#17171C" strokeWidth="2" />
            </>
          )}
          {/* body (1:1.15) */}
          <ellipse cx="40" cy="48" rx="31" ry="36" fill="#FFF9F2" stroke="#17171C" strokeWidth="2" />
          {/* belly */}
          <ellipse cx="40" cy="62" rx="17" ry="17" fill="#FFFFFF" stroke="none" opacity="0.7" />
          {/* wings */}
          <ellipse
            cx="12"
            cy="52"
            rx="7.5"
            ry="15"
            fill="#7C3AED"
            stroke="#17171C"
            strokeWidth="2"
            transform="rotate(12 12 52)"
            className={cn(mode === "success" && "ollie-wing-flap")}
          />
          <ellipse cx="68" cy="52" rx="7.5" ry="15" fill="#7C3AED" stroke="#17171C" strokeWidth="2" transform="rotate(-12 68 52)" />
          {/* eyes */}
          <circle cx="29" cy="34" r="12.5" fill="#FFFFFF" stroke="#17171C" strokeWidth="2" />
          <circle cx="51" cy="34" r="12.5" fill="#FFFFFF" stroke="#17171C" strokeWidth="2" />
          {/* pupils: look up-left when thinking */}
          <g className={cn(mode === "idle" && "ollie-eye")}>
            <circle cx={mode === "thinking" ? 26 : 29} cy={mode === "thinking" ? 31 : 34} r="5.8" fill="#17171C" />
            <circle cx={mode === "thinking" ? 48 : 51} cy={mode === "thinking" ? 31 : 34} r="5.8" fill="#17171C" />
            <circle cx={mode === "thinking" ? 23.8 : 26.8} cy={mode === "thinking" ? 28.8 : 31.8} r="1.9" fill="#FFFFFF" />
            <circle cx={mode === "thinking" ? 45.8 : 48.8} cy={mode === "thinking" ? 28.8 : 31.8} r="1.9" fill="#FFFFFF" />
          </g>
          {/* beak (points down) */}
          <path d="M35.5 44 L44.5 44 L40 50.5 Z" fill="#B45309" stroke="#17171C" strokeWidth="2" />
        </g>
      </svg>
    </div>
  );
}
