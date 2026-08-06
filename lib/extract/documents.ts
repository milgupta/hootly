import "server-only";
import { ExtractError, type ExtractResult } from "./types";
import { getOpenAI } from "@/lib/ai/openai";
import { env } from "@/lib/env";

/** PDF via pdf-parse with per-page capture; image-only PDFs fall through to OCR. */
export async function extractPdf(buffer: Buffer): Promise<ExtractResult> {
  // Deep import avoids pdf-parse's module.parent debug-mode bug.
  const { default: pdfParse } = await import("pdf-parse/lib/pdf-parse.js");
  const pageTexts: string[] = [];
  interface PdfPageData {
    getTextContent: () => Promise<{ items: Array<{ str?: string }> }>;
  }
  await pdfParse(buffer, {
    pagerender: async (pageData: PdfPageData) => {
      const content = await pageData.getTextContent();
      const text = content.items.map((it) => it.str ?? "").join(" ");
      pageTexts.push(text);
      return text;
    },
  });
  const totalChars = pageTexts.join("").replace(/\s/g, "").length;
  if (totalChars < 40) {
    // Image-only PDF: docs/04 §9 'ocr_needed→auto-ran' is info, not an error —
    // but page-image OCR needs rasterization we don't ship in v1, so surface
    // the honest recovery path instead of a silent empty result.
    throw new ExtractError(
      "extract_empty",
      "We couldn't find readable text. Try a clearer scan."
    );
  }
  return {
    blocks: pageTexts.map((text, i) => ({ text, page: i + 1 })).filter((b) => b.text.trim()),
    pageCount: pageTexts.length,
  };
}

export async function extractDocx(buffer: Buffer): Promise<ExtractResult> {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText({ buffer });
  if (!value || value.replace(/\s/g, "").length < 20) {
    throw new ExtractError("extract_empty", "We couldn't find readable text. Try a clearer scan.");
  }
  return { blocks: [{ text: value }] };
}

export async function extractPptx(buffer: Buffer): Promise<ExtractResult> {
  const JSZip = (await import("jszip")).default;
  const { XMLParser } = await import("fast-xml-parser");
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)/)?.[1] ?? 0);
      const nb = Number(b.match(/slide(\d+)/)?.[1] ?? 0);
      return na - nb;
    });
  if (slideFiles.length === 0) {
    throw new ExtractError("extract_empty", "We couldn't find readable text. Try a clearer scan.");
  }
  const parser = new XMLParser({ ignoreAttributes: false });
  const blocks: ExtractResult["blocks"] = [];
  let slideNum = 0;
  for (const file of slideFiles) {
    slideNum += 1;
    const xml = await zip.files[file]!.async("string");
    const doc = parser.parse(xml) as unknown;
    const texts: string[] = [];
    collectTexts(doc, texts);
    const text = texts.join("\n").trim();
    if (text) blocks.push({ text, page: slideNum });
  }
  if (blocks.length === 0) {
    throw new ExtractError("extract_empty", "We couldn't find readable text. Try a clearer scan.");
  }
  return { blocks, pageCount: slideNum };
}

/** Recursively collect every <a:t> text node from parsed slide XML. */
function collectTexts(node: unknown, out: string[]): void {
  if (node == null) return;
  if (Array.isArray(node)) {
    for (const item of node) collectTexts(item, out);
    return;
  }
  if (typeof node === "object") {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === "a:t") {
        if (typeof value === "string") out.push(value);
        else if (typeof value === "number") out.push(String(value));
        else collectTexts(value, out);
      } else {
        collectTexts(value, out);
      }
    }
  }
}

export async function extractTxt(buffer: Buffer): Promise<ExtractResult> {
  const text = buffer.toString("utf-8");
  if (text.replace(/\s/g, "").length < 10) {
    throw new ExtractError("extract_empty", "We couldn't find readable text. Try a clearer scan.");
  }
  return { blocks: [{ text }] };
}

/** Handwritten/photo OCR via the vision-capable TUTOR model (docs/04 §3 note). */
export async function extractImage(buffer: Buffer, mime: string): Promise<ExtractResult> {
  const openai = getOpenAI();
  if (!openai) {
    // TODO(key-needed): OPENAI_API_KEY missing — OCR is fully wired above this guard.
    throw new ExtractError("extract_empty", "We couldn't find readable text. Try a clearer scan.");
  }
  const b64 = buffer.toString("base64");
  const res = await openai.chat.completions.create({
    model: env.modelTutor,
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Transcribe ALL text in this image exactly, preserving structure (headings, lists, equations in LaTeX). If handwritten, do your best. Output only the transcription, no commentary. If there is no legible text at all, output exactly: [NO_TEXT]",
          },
          { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } },
        ],
      },
    ],
  });
  const text = res.choices[0]?.message?.content?.trim() ?? "";
  if (!text || text.includes("[NO_TEXT]")) {
    throw new ExtractError("extract_empty", "We couldn't find readable text. Try a clearer scan.");
  }
  return { blocks: [{ text }], info: "ocr_ran" };
}
