import type { MaterialKind } from "@/lib/types";

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100MB (docs/04 §9)

export const EXT_KIND: Record<string, MaterialKind> = {
  pdf: "pdf", pptx: "pptx", ppt: "pptx", docx: "docx", doc: "docx", txt: "txt", md: "txt",
  png: "image", jpg: "image", jpeg: "image", webp: "image", heic: "image", gif: "image",
  mp3: "audio", m4a: "audio", wav: "audio", aac: "audio", ogg: "audio",
  mp4: "video", mov: "video", webm: "video", mkv: "video",
};

export function kindForFilename(filename: string): MaterialKind | null {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return EXT_KIND[ext] ?? null;
}

export const ACCEPT_ATTR = Object.keys(EXT_KIND)
  .map((e) => `.${e}`)
  .join(",");
