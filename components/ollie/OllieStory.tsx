import * as React from "react";

/**
 * Storybook Ollie — cozy library scene for paywall + auth panels (docs/05 §12).
 * Static illustrated SVG: shelves, lamp light, books, Ollie reading.
 */
export function OllieStory({ width = 280, className }: { width?: number; className?: string }) {
  const height = Math.round(width * 1.1);
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 280 308"
      role="img"
      aria-label="Ollie reading in a cozy library"
      className={className}
    >
      {/* warm backdrop */}
      <rect width="280" height="308" rx="24" fill="#F3EEFD" />
      <radialGradient id="lamp" cx="0.5" cy="0.18" r="0.7">
        <stop offset="0%" stopColor="#FDF5EC" stopOpacity="0.9" />
        <stop offset="100%" stopColor="#FDF5EC" stopOpacity="0" />
      </radialGradient>
      <rect width="280" height="308" rx="24" fill="url(#lamp)" />
      {/* shelf */}
      <rect x="28" y="52" width="224" height="8" rx="3" fill="#DDD0F9" />
      {/* books on shelf */}
      <g stroke="#17171C" strokeWidth="1.5" strokeLinejoin="round">
        <rect x="40" y="20" width="13" height="32" rx="2" fill="#7C3AED" />
        <rect x="56" y="26" width="12" height="26" rx="2" fill="#FFFFFF" />
        <rect x="71" y="16" width="14" height="36" rx="2" fill="#DDD0F9" />
        <rect x="88" y="24" width="11" height="28" rx="2" fill="#FFF9F2" />
        <rect x="180" y="22" width="13" height="30" rx="2" fill="#FFFFFF" />
        <rect x="196" y="18" width="12" height="34" rx="2" fill="#7C3AED" />
        <rect x="211" y="27" width="13" height="25" rx="2" fill="#FFF9F2" />
      </g>
      {/* lamp */}
      <g stroke="#17171C" strokeWidth="2" strokeLinejoin="round">
        <line x1="236" y1="130" x2="236" y2="196" />
        <path d="M222 130 L250 130 L243 112 L229 112 Z" fill="#B45309" />
        <rect x="226" y="196" width="20" height="6" rx="3" fill="#17171C" />
      </g>
      {/* Ollie reading */}
      <g strokeLinejoin="round" strokeLinecap="round" transform="translate(60 120)">
        <path d="M28 96 q2 5 6 0" fill="none" stroke="#17171C" strokeWidth="2" />
        <path d="M46 96 q2 5 6 0" fill="none" stroke="#17171C" strokeWidth="2" />
        <path d="M23 16 L28 6 L33 17 Z" fill="#7C3AED" stroke="#17171C" strokeWidth="2" />
        <path d="M57 16 L52 6 L47 17 Z" fill="#7C3AED" stroke="#17171C" strokeWidth="2" />
        <ellipse cx="40" cy="54" rx="32" ry="42" fill="#FFF9F2" stroke="#17171C" strokeWidth="2" />
        <ellipse cx="40" cy="70" rx="18" ry="18" fill="#FFFFFF" opacity="0.7" />
        <circle cx="28" cy="38" r="12" fill="#FFFFFF" stroke="#17171C" strokeWidth="2" />
        <circle cx="52" cy="38" r="12" fill="#FFFFFF" stroke="#17171C" strokeWidth="2" />
        {/* eyes looking down at the book */}
        <circle cx="28" cy="42" r="5.4" fill="#17171C" />
        <circle cx="52" cy="42" r="5.4" fill="#17171C" />
        <circle cx="26" cy="40" r="1.7" fill="#FFFFFF" />
        <circle cx="50" cy="40" r="1.7" fill="#FFFFFF" />
        <path d="M36 50 L44 50 L40 56 Z" fill="#B45309" stroke="#17171C" strokeWidth="2" />
        {/* open book held by wings */}
        <path d="M6 78 Q23 68 40 78 Q57 68 74 78 L74 96 Q57 86 40 96 Q23 86 6 96 Z" fill="#FFFFFF" stroke="#17171C" strokeWidth="2" />
        <line x1="40" y1="78" x2="40" y2="96" stroke="#17171C" strokeWidth="2" />
        {/* purple wing tips on the book edges */}
        <ellipse cx="8" cy="80" rx="6" ry="9" fill="#7C3AED" stroke="#17171C" strokeWidth="2" transform="rotate(20 8 80)" />
        <ellipse cx="72" cy="80" rx="6" ry="9" fill="#7C3AED" stroke="#17171C" strokeWidth="2" transform="rotate(-20 72 80)" />
      </g>
      {/* rug */}
      <ellipse cx="100" cy="242" rx="78" ry="14" fill="#DDD0F9" opacity="0.6" />
    </svg>
  );
}
