import "server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, writeFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ExtractError, type ExtractResult } from "./types";
import { getOpenAI } from "@/lib/ai/openai";
import { env } from "@/lib/env";
import { FREE_AUDIO_MAX_SECONDS } from "@/lib/billing/limits";

const execFileAsync = promisify(execFile);

async function ffmpegPath(): Promise<string> {
  const mod = await import("ffmpeg-static");
  const p = (mod.default ?? mod) as unknown as string;
  if (!p) throw new Error("ffmpeg-static binary missing");
  return p;
}

function mmss(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Audio/video → 64kbps mono m4a → ≤20-min segments (whisper's 25MB cap) →
 *  whisper each → stitch with timestamps (docs/04 §6). */
export async function extractMedia(
  buffer: Buffer,
  ext: string,
  plan: "free" | "plus"
): Promise<ExtractResult> {
  const openai = getOpenAI();
  if (!openai) {
    // TODO(key-needed): OPENAI_API_KEY missing — transcription wired above this guard.
    throw new ExtractError("extract_empty", "We couldn't find readable text. Try a clearer scan.");
  }
  const ffmpeg = await ffmpegPath();
  const dir = await mkdtemp(path.join(tmpdir(), "hootly-media-"));
  try {
    const inputPath = path.join(dir, `input.${ext}`);
    await writeFile(inputPath, buffer);

    // Probe duration via ffmpeg (stderr parse — ffprobe isn't bundled).
    let durationSeconds = 0;
    try {
      await execFileAsync(ffmpeg, ["-i", inputPath, "-f", "null", "-"], { maxBuffer: 64 * 1024 * 1024 });
    } catch (e) {
      const err = e as { stderr?: string };
      const m = err.stderr?.match(/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/);
      if (m) durationSeconds = Number(m[1]) * 3600 + Number(m[2]) * 60 + Math.floor(Number(m[3]));
    }
    if (!durationSeconds) {
      const { stderr } = await execFileAsync(ffmpeg, ["-i", inputPath, "-f", "null", "-"], {
        maxBuffer: 64 * 1024 * 1024,
      }).catch((e) => e as { stderr: string });
      const m = (stderr ?? "").match(/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/);
      if (m) durationSeconds = Number(m[1]) * 3600 + Number(m[2]) * 60 + Math.floor(Number(m[3]));
    }

    if (plan === "free" && durationSeconds > FREE_AUDIO_MAX_SECONDS) {
      throw new ExtractError(
        "audio_too_long",
        `Free plan covers recordings up to 30 minutes — this one is ${mmss(durationSeconds)}.`
      );
    }

    // Transcode to 64kbps mono m4a, split into ≤20-min segments.
    const segPattern = path.join(dir, "seg-%03d.m4a");
    await execFileAsync(
      ffmpeg,
      ["-i", inputPath, "-vn", "-ac", "1", "-b:a", "64k", "-f", "segment", "-segment_time", "1200", segPattern],
      { maxBuffer: 64 * 1024 * 1024 }
    );
    const segments = (await readdir(dir)).filter((f) => f.startsWith("seg-")).sort();
    if (segments.length === 0) {
      throw new ExtractError("extract_empty", "We couldn't find readable text. Try a clearer scan.");
    }

    const blocks: ExtractResult["blocks"] = [];
    let offset = 0;
    for (const seg of segments) {
      const segBuffer = await readFile(path.join(dir, seg));
      const file = new File([new Uint8Array(segBuffer)], seg, { type: "audio/mp4" });
      const res = await openai.audio.transcriptions.create({
        model: env.modelTranscribe,
        file,
        response_format: "verbose_json",
      });
      const verbose = res as unknown as {
        duration?: number;
        segments?: Array<{ start: number; end: number; text: string }>;
        text?: string;
      };
      if (verbose.segments && verbose.segments.length > 0) {
        for (const s of verbose.segments) {
          const text = s.text.trim();
          if (text) {
            blocks.push({
              text,
              startSeconds: Math.floor(offset + s.start),
              endSeconds: Math.ceil(offset + s.end),
            });
          }
        }
      } else if (verbose.text?.trim()) {
        blocks.push({ text: verbose.text.trim(), startSeconds: Math.floor(offset) });
      }
      offset += verbose.duration ?? 1200;
    }
    if (blocks.length === 0) {
      throw new ExtractError("extract_empty", "We couldn't find readable text. Try a clearer scan.");
    }
    return { blocks, durationSeconds: Math.floor(durationSeconds) || undefined };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
