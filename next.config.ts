import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "ffmpeg-static", "@react-pdf/renderer", "youtubei.js"],
};

export default nextConfig;
