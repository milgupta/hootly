import * as React from "react";

/** 16×16 pixel-art Ollie for onboarding (docs/05 §12). Rendered as SVG rects. */
const GRID = [
  "................",
  "..P..........P..",
  "..PP........PP..",
  "...CCCCCCCCCC...",
  "..CCCCCCCCCCCC..",
  ".CCWWCCCCCCWWCC.",
  ".CWWWWCCCCWWWWC.",
  ".CWKKWCCCCWKKWC.",
  ".CWKKWCCCCWKKWC.",
  ".CCWWCCOOCCWWCC.",
  ".PCCCCCOOCCCCCP.",
  ".PPCCCCCCCCCCPP.",
  ".PPCCCCCCCCCCPP.",
  "..CCCCCCCCCCCC..",
  "...CCCCCCCCCC...",
  "....K......K....",
];

const COLORS: Record<string, string> = {
  P: "#7C3AED",
  C: "#FFF9F2",
  W: "#FFFFFF",
  K: "#17171C",
  O: "#B45309",
};

export function OlliePixel({ size = 64, className }: { size?: number; className?: string }) {
  const cell = 1;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      role="img"
      aria-label="Pixel Ollie"
      className={className}
      style={{ imageRendering: "pixelated" }}
      shapeRendering="crispEdges"
    >
      {GRID.flatMap((row, y) =>
        row.split("").map((ch, x) => {
          const fill = COLORS[ch];
          if (!fill) return null;
          return <rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell} height={cell} fill={fill} />;
        })
      )}
    </svg>
  );
}
