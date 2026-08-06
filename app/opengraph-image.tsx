import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Hootly — the AI study platform students actually trust";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#FFFFFF",
          backgroundImage: "radial-gradient(60% 50% at 50% 0%, #F3EEFD 0%, #FFFFFF 70%)",
          fontFamily: "sans-serif",
        }}
      >
        <svg width="140" height="140" viewBox="0 0 64 64">
          <path d="M18 12 L24 4 L28 13 Z" fill="#7C3AED" stroke="#17171C" strokeWidth="2" />
          <path d="M46 12 L40 4 L36 13 Z" fill="#7C3AED" stroke="#17171C" strokeWidth="2" />
          <circle cx="32" cy="34" r="27" fill="#FFF9F2" stroke="#17171C" strokeWidth="2" />
          <circle cx="21.5" cy="30" r="11" fill="#FFFFFF" stroke="#17171C" strokeWidth="2" />
          <circle cx="42.5" cy="30" r="11" fill="#FFFFFF" stroke="#17171C" strokeWidth="2" />
          <circle cx="21.5" cy="30" r="5.2" fill="#17171C" />
          <circle cx="42.5" cy="30" r="5.2" fill="#17171C" />
          <circle cx="19.6" cy="28" r="1.7" fill="#FFFFFF" />
          <circle cx="40.6" cy="28" r="1.7" fill="#FFFFFF" />
          <path d="M27.5 45 L36.5 45 L32 51.5 Z" fill="#B45309" stroke="#17171C" strokeWidth="2" />
        </svg>
        <div style={{ display: "flex", fontSize: 64, fontWeight: 700, color: "#17171C", marginTop: 24 }}>
          hootly
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#5C5C6B", marginTop: 12 }}>
          Turn tonight's panic into tomorrow's A.
        </div>
      </div>
    ),
    { ...size }
  );
}
