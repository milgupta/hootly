import type { SourceBlock } from "@/lib/ai/rag";

export interface ExtractResult {
  blocks: SourceBlock[];
  pageCount?: number;
  durationSeconds?: number;
  /** ocr_needed→auto-ran is an info marker, not an error (docs/04 §9). */
  info?: "ocr_ran";
}

/** Thrown by extractors with a canonical error code (docs/04 §9) + UI sentence. */
export class ExtractError extends Error {
  code: string;
  detail: string;
  constructor(code: string, detail: string) {
    super(code);
    this.code = code;
    this.detail = detail;
  }
}
