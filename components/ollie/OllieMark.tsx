import * as React from "react";

/**
 * Geometric Ollie mark (head only) — works at 16px favicon size (docs/05 §12).
 * Cream face #FFF9F2, ink outline 2px rounded, purple brow tufts, warning-orange beak.
 */
export function OllieMark({
  size = 32,
  className,
  title = "Hootly",
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      className={className}
    >
      <g strokeLinejoin="round" strokeLinecap="round">
        {/* brow feather tufts */}
        <path d="M18 12 L24 4 L28 13 Z" fill="#7C3AED" stroke="#17171C" strokeWidth="2" />
        <path d="M46 12 L40 4 L36 13 Z" fill="#7C3AED" stroke="#17171C" strokeWidth="2" />
        {/* head */}
        <circle cx="32" cy="34" r="27" fill="#FFF9F2" stroke="#17171C" strokeWidth="2" />
        {/* eyes ~38% of face width */}
        <circle cx="21.5" cy="30" r="11" fill="#FFFFFF" stroke="#17171C" strokeWidth="2" />
        <circle cx="42.5" cy="30" r="11" fill="#FFFFFF" stroke="#17171C" strokeWidth="2" />
        <circle cx="21.5" cy="30" r="5.2" fill="#17171C" />
        <circle cx="42.5" cy="30" r="5.2" fill="#17171C" />
        {/* glint at 10 o'clock */}
        <circle cx="19.6" cy="28" r="1.7" fill="#FFFFFF" />
        <circle cx="40.6" cy="28" r="1.7" fill="#FFFFFF" />
        {/* beak */}
        <path d="M32 38 L27.5 44.5 L36.5 44.5 Z" fill="#B45309" stroke="#17171C" strokeWidth="2"
          transform="rotate(180 32 41.5)" />
      </g>
    </svg>
  );
}
