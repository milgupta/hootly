import "server-only";
import { ExtractError, type ExtractResult } from "./types";

/** YouTube: captions only via youtubei.js — no audio download in v1 (docs/04 §1).
 *  No captions → hard error 'yt_no_captions'. */
export async function extractYouTube(url: string): Promise<ExtractResult & { title?: string }> {
  const videoId = parseYouTubeId(url);
  if (!videoId) {
    throw new ExtractError("yt_unavailable", "This video is private or region-locked.");
  }
  try {
    const { Innertube } = await import("youtubei.js");
    const yt = await Innertube.create({ retrieve_player: false });
    const info = await yt.getInfo(videoId);
    const title = info.basic_info?.title ?? "YouTube video";
    const durationSeconds = info.basic_info?.duration ?? undefined;

    let transcriptInfo;
    try {
      transcriptInfo = await info.getTranscript();
    } catch {
      throw new ExtractError(
        "yt_no_captions",
        "This video has no captions — download the audio and upload it instead."
      );
    }
    const segments =
      transcriptInfo?.transcript?.content?.body?.initial_segments ?? [];
    const blocks: ExtractResult["blocks"] = [];
    for (const seg of segments) {
      const s = seg as unknown as {
        snippet?: { text?: string };
        start_ms?: string | number;
        end_ms?: string | number;
      };
      const text = s.snippet?.text?.trim();
      if (!text) continue;
      blocks.push({
        text,
        startSeconds: Math.floor(Number(s.start_ms ?? 0) / 1000),
        endSeconds: Math.ceil(Number(s.end_ms ?? 0) / 1000),
      });
    }
    if (blocks.length === 0) {
      throw new ExtractError(
        "yt_no_captions",
        "This video has no captions — download the audio and upload it instead."
      );
    }
    return { blocks, durationSeconds, title };
  } catch (e) {
    if (e instanceof ExtractError) throw e;
    throw new ExtractError("yt_unavailable", "This video is private or region-locked.");
  }
}

export function parseYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([\w-]{11})/,
    /(?:youtu\.be\/)([\w-]{11})/,
    /(?:youtube\.com\/shorts\/)([\w-]{11})/,
    /(?:youtube\.com\/embed\/)([\w-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1]!;
  }
  return null;
}
