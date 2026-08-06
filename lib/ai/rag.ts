import "server-only";
import { getOpenAI } from "@/lib/ai/openai";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

/** RAG pipeline (docs/06 §1, normative):
 *  - Chunking: ~800 tokens, 15% overlap, split on headings/paragraphs first,
 *    each chunk keeps its locator (page OR start/end seconds).
 *  - Embeddings: OPENAI_MODEL_EMBED, 1536-dim, batch 64.
 *  - Retrieval: cosine pgvector HNSW, top-k 12, similarity floor 0.25, course scope.
 *  - Low-confidence rule: <3 chunks over the floor → caller must say so.
 *  - Chunk ID contract: prompts see 8-char prefixes ([chunk:a1b2c3d4]); a per-request
 *    prefix→uuid map resolves citations back before persisting. */

export const TOP_K = 12;
export const SIM_FLOOR = 0.25;
export const LOW_CONFIDENCE_MIN = 3;

const CHUNK_TOKENS = 800;
const OVERLAP_RATIO = 0.15;

/** ~4 chars/token heuristic — fine for chunk sizing. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface SourceBlock {
  text: string;
  page?: number | null;
  startSeconds?: number | null;
  endSeconds?: number | null;
}

export interface PreparedChunk {
  idx: number;
  content: string;
  page: number | null;
  start_seconds: number | null;
  end_seconds: number | null;
  token_count: number;
}

/** Split blocks into ~800-token chunks with 15% overlap, preserving locators.
 *  Paragraph/heading boundaries first; hard-split only oversized paragraphs. */
export function chunkBlocks(blocks: SourceBlock[]): PreparedChunk[] {
  interface Para {
    text: string;
    page: number | null;
    start: number | null;
    end: number | null;
  }
  const paras: Para[] = [];
  for (const block of blocks) {
    const pieces = block.text
      .split(/\n{2,}|(?=^#{1,6}\s)/m)
      .map((p) => p.trim())
      .filter(Boolean);
    for (const piece of pieces) {
      if (estimateTokens(piece) > CHUNK_TOKENS) {
        // Hard-split oversized paragraphs on sentence boundaries.
        const sentences = piece.split(/(?<=[.!?])\s+/);
        let buf = "";
        for (const s of sentences) {
          if (estimateTokens(buf + " " + s) > CHUNK_TOKENS && buf) {
            paras.push({ text: buf.trim(), page: block.page ?? null, start: block.startSeconds ?? null, end: block.endSeconds ?? null });
            buf = s;
          } else {
            buf = buf ? `${buf} ${s}` : s;
          }
        }
        if (buf.trim()) paras.push({ text: buf.trim(), page: block.page ?? null, start: block.startSeconds ?? null, end: block.endSeconds ?? null });
      } else {
        paras.push({ text: piece, page: block.page ?? null, start: block.startSeconds ?? null, end: block.endSeconds ?? null });
      }
    }
  }

  const chunks: PreparedChunk[] = [];
  let current: Para[] = [];
  let currentTokens = 0;

  const flush = () => {
    if (current.length === 0) return;
    const content = current.map((p) => p.text).join("\n\n");
    const first = current[0]!;
    const last = current[current.length - 1]!;
    chunks.push({
      idx: chunks.length,
      content,
      page: first.page,
      start_seconds: first.start,
      end_seconds: last.end ?? last.start,
      token_count: estimateTokens(content),
    });
    // 15% overlap: keep trailing paragraphs into the next chunk.
    const overlapTarget = CHUNK_TOKENS * OVERLAP_RATIO;
    const kept: Para[] = [];
    let keptTokens = 0;
    for (let i = current.length - 1; i >= 0; i--) {
      const p = current[i]!;
      const t = estimateTokens(p.text);
      if (keptTokens + t > overlapTarget) break;
      kept.unshift(p);
      keptTokens += t;
    }
    current = kept;
    currentTokens = keptTokens;
  };

  for (const para of paras) {
    const t = estimateTokens(para.text);
    if (currentTokens + t > CHUNK_TOKENS && current.length > 0) flush();
    current.push(para);
    currentTokens += t;
  }
  if (current.length > 0 && (chunks.length === 0 || current.some((p) => !chunks[chunks.length - 1]!.content.includes(p.text)))) {
    const content = current.map((p) => p.text).join("\n\n");
    const first = current[0]!;
    const last = current[current.length - 1]!;
    chunks.push({
      idx: chunks.length,
      content,
      page: first.page,
      start_seconds: first.start,
      end_seconds: last.end ?? last.start,
      token_count: estimateTokens(content),
    });
  }
  return chunks;
}

/** Embed texts with OPENAI_MODEL_EMBED in batches of 64. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const openai = getOpenAI();
  if (!openai) throw new Error("openai_not_configured"); // TODO(key-needed)
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 64) {
    const batch = texts.slice(i, i + 64).map((t) => t.slice(0, 8000));
    const res = await openai.embeddings.create({ model: env.modelEmbed, input: batch });
    for (const d of res.data) out.push(d.embedding);
  }
  return out;
}

export interface RetrievedChunk {
  id: string;
  material_id: string;
  content: string;
  page: number | null;
  start_seconds: number | null;
  end_seconds: number | null;
  similarity: number;
  material_title: string;
}

/** Retrieve top-k chunks for a query within a course (optionally one material). */
export async function retrieveChunks(
  courseId: string,
  query: string,
  opts: { topK?: number; floor?: number; materialId?: string } = {}
): Promise<RetrievedChunk[]> {
  const admin = createAdminClient();
  if (!admin) throw new Error("supabase_not_configured"); // TODO(key-needed)
  const [embedding] = await embedTexts([query]);
  const { data, error } = await admin.rpc("match_chunks", {
    p_course_id: courseId,
    p_query: embedding,
    p_top_k: opts.topK ?? TOP_K,
    p_floor: opts.floor ?? SIM_FLOOR,
  });
  if (error) throw new Error(`retrieval_failed: ${error.message}`);
  let rows = (data ?? []) as Omit<RetrievedChunk, "material_title">[];
  if (opts.materialId) rows = rows.filter((r) => r.material_id === opts.materialId);
  return attachMaterialTitles(rows);
}

/** All chunks of a course in document order (for generation over full material). */
export async function getCourseChunks(courseId: string, limit = 400): Promise<RetrievedChunk[]> {
  const admin = createAdminClient();
  if (!admin) throw new Error("supabase_not_configured");
  const { data } = await admin
    .from("chunks")
    .select("id, material_id, content, page, start_seconds, end_seconds")
    .eq("course_id", courseId)
    .order("material_id")
    .order("idx")
    .limit(limit);
  const rows = (data ?? []).map((r) => ({ ...r, similarity: 1 })) as Omit<RetrievedChunk, "material_title">[];
  return attachMaterialTitles(rows);
}

async function attachMaterialTitles(
  rows: Omit<RetrievedChunk, "material_title">[]
): Promise<RetrievedChunk[]> {
  const admin = createAdminClient();
  if (!admin || rows.length === 0) return rows.map((r) => ({ ...r, material_title: "" }));
  const ids = [...new Set(rows.map((r) => r.material_id))];
  const { data } = await admin.from("materials").select("id, title").in("id", ids);
  const titles = new Map((data ?? []).map((m) => [m.id, m.title]));
  return rows.map((r) => ({ ...r, material_title: titles.get(r.material_id) ?? "Material" }));
}

/** Chunk ID contract: 8-char prefixes in prompts; map resolves back to uuids. */
export interface ChunkContext {
  block: string;
  prefixToUuid: Map<string, string>;
  chunks: RetrievedChunk[];
}

export function formatLocator(chunk: Pick<RetrievedChunk, "page" | "start_seconds">): string {
  if (chunk.start_seconds != null) {
    const m = Math.floor(chunk.start_seconds / 60);
    const s = chunk.start_seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  if (chunk.page != null) return `p.${chunk.page}`;
  return "";
}

/** Render context blocks: `[chunk:{uuid8}] ({material_title}, {p.12 | 03:41})\n{content}` */
export function buildChunkContext(chunks: RetrievedChunk[], tokenBudget: number): ChunkContext {
  const prefixToUuid = new Map<string, string>();
  const parts: string[] = [];
  const used: RetrievedChunk[] = [];
  let tokens = 0;
  for (const chunk of chunks) {
    const prefix = chunk.id.replace(/-/g, "").slice(0, 8);
    const locator = formatLocator(chunk);
    const block = `[chunk:${prefix}] (${chunk.material_title}${locator ? `, ${locator}` : ""})\n${chunk.content}`;
    const t = estimateTokens(block);
    if (tokens + t > tokenBudget && parts.length > 0) break;
    prefixToUuid.set(prefix, chunk.id);
    parts.push(block);
    used.push(chunk);
    tokens += t;
  }
  return { block: parts.join("\n\n"), prefixToUuid, chunks: used };
}

/** Resolve [chunk:PREFIX] citations in model output back to full uuids. */
export function resolveCitations(ids: string[], map: Map<string, string>): string[] {
  const out: string[] = [];
  for (const raw of ids) {
    const key = raw.trim().replace(/^chunk:/, "").slice(0, 8);
    const uuid = map.get(key);
    if (uuid && !out.includes(uuid)) out.push(uuid);
  }
  return out;
}

/** Strip inline [chunk:ID] markers from markdown for rendering. */
export function stripChunkMarkers(md: string): string {
  return md.replace(/\s*\[chunk:[a-f0-9]{4,32}\]/gi, "");
}

/** Extract [chunk:ID] markers in order of appearance. */
export function extractChunkMarkers(md: string): string[] {
  const out: string[] = [];
  const re = /\[chunk:([a-f0-9]{4,32})\]/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md))) {
    const id = m[1]!.toLowerCase();
    if (!out.includes(id)) out.push(id);
  }
  return out;
}
