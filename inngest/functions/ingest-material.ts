import { NonRetriableError } from "inngest";
import { inngest } from "@/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { broadcastJobEvent } from "@/lib/realtime";
import { chunkBlocks, embedTexts } from "@/lib/ai/rag";
import { ExtractError, type ExtractResult } from "@/lib/extract/types";
import {
  extractDocx,
  extractImage,
  extractPdf,
  extractPptx,
  extractTxt,
} from "@/lib/extract/documents";
import { extractMedia } from "@/lib/extract/media";
import { extractYouTube } from "@/lib/extract/youtube";
import { parseQuizlet } from "@/lib/extract/quizlet";
import { incrementUsage, getPlanAdmin } from "@/lib/billing/usage";
import { capturePostHog } from "@/lib/analytics/server";
import type { Material } from "@/lib/types";

const MIME_BY_EXT: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
  gif: "image/gif", heic: "image/heic",
};

/** Ingestion job (docs/04 §6): download → extract by kind → chunk (~800 tok, 15%
 *  overlap, locators) → embed (batch 64) → insert chunks → status ready.
 *  Failures set status='failed' + error_code/error_detail and leave prior
 *  artifacts untouched. Progress via Realtime 'job:{materialId}'. */
export const ingestMaterial = inngest.createFunction(
  { id: "ingest-material", retries: 2 },
  { event: "material/uploaded" },
  async ({ event, step }) => {
    const materialId = event.data.materialId as string;
    const admin = createAdminClient();
    if (!admin) return { skipped: "no service role key" }; // TODO(key-needed)

    const material = (await step.run("load-material", async () => {
      const { data } = await admin.from("materials").select("*").eq("id", materialId).maybeSingle();
      if (!data) throw new NonRetriableError("material not found");
      await admin.from("materials").update({ status: "processing", error_code: null, error_detail: null }).eq("id", materialId);
      await broadcastJobEvent(materialId, { stage: "processing", pct: 5 });
      return data;
    })) as Material;

    const fail = async (code: string, detail: string) => {
      await admin
        .from("materials")
        .update({ status: "failed", error_code: code, error_detail: detail })
        .eq("id", materialId);
      await broadcastJobEvent(materialId, { stage: "failed", error_code: code, error_detail: detail });
      await capturePostHog(material.user_id, "material_upload_failed", {
        kind: material.kind,
        error_code: code,
      });
    };

    // ---- topic marker: no extraction (docs/04 §6) --------------------------
    if (material.kind === "topic") {
      await step.run("finish-topic", async () => {
        await admin.from("materials").update({ status: "ready" }).eq("id", materialId);
        await broadcastJobEvent(materialId, { stage: "ready", pct: 100 });
      });
      return { ok: true, topic: true };
    }

    // ---- quizlet: parse term<TAB>definition into flashcards ----------------
    if (material.kind === "quizlet") {
      return await step.run("quizlet-import", async () => {
        const cards = parseQuizlet(material.raw_text ?? "");
        if (cards.length === 0) {
          await fail("extract_empty", "We couldn't find readable text. Try a clearer scan.");
          return { ok: false };
        }
        const { error } = await admin.from("flashcards").insert(
          cards.map((c) => ({
            course_id: material.course_id,
            user_id: material.user_id,
            kind: "basic",
            front: c.front,
            back: c.back,
          }))
        );
        if (error) throw new Error(error.message);
        // Quizlet-imported cards DO count toward cards_generated (docs/04 §5).
        await incrementUsage(material.user_id, "cards_generated", cards.length);
        await admin.from("materials").update({ status: "ready" }).eq("id", materialId);
        await broadcastJobEvent(materialId, { stage: "ready", pct: 100, cards: cards.length });
        await capturePostHog(material.user_id, "material_upload_succeeded", {
          kind: "quizlet",
          cards: cards.length,
        });
        return { ok: true, cards: cards.length };
      });
    }

    // ---- extract text by kind ---------------------------------------------
    let extracted: ExtractResult;
    try {
      extracted = (await step.run("extract", async () => {
        await broadcastJobEvent(materialId, { stage: "extracting", pct: 15 });

        if (material.kind === "pasted") {
          const text = material.raw_text ?? "";
          if (text.replace(/\s/g, "").length < 10) {
            throw new ExtractError("extract_empty", "We couldn't find readable text. Try a clearer scan.");
          }
          return { blocks: [{ text }] } satisfies ExtractResult;
        }

        if (material.kind === "youtube") {
          const res = await extractYouTube(material.source_url ?? "");
          if (res.title && material.title === "YouTube video") {
            await admin.from("materials").update({ title: res.title }).eq("id", materialId);
          }
          return res;
        }

        // Storage-backed kinds.
        if (!material.storage_path) {
          throw new ExtractError("unsupported_format", "This file couldn't be read — try another format.");
        }
        const { data: blob, error: dlError } = await admin.storage
          .from("materials")
          .download(material.storage_path);
        if (dlError || !blob) throw new Error(`download failed: ${dlError?.message}`);
        const buffer = Buffer.from(await blob.arrayBuffer());
        const ext = material.storage_path.split(".").pop()?.toLowerCase() ?? "";

        switch (material.kind) {
          case "pdf":
            return await extractPdf(buffer);
          case "docx":
            return await extractDocx(buffer);
          case "pptx":
            return await extractPptx(buffer);
          case "txt":
            return await extractTxt(buffer);
          case "image":
            return await extractImage(buffer, MIME_BY_EXT[ext] ?? "image/png");
          case "audio":
          case "video": {
            const plan = await getPlanAdmin(material.user_id);
            return await extractMedia(buffer, ext || "mp3", plan);
          }
          default:
            throw new ExtractError("unsupported_format", "This file couldn't be read — try another format.");
        }
      })) as ExtractResult;
    } catch (e) {
      const cause = unwrapExtractError(e);
      if (cause) {
        await fail(cause.code, cause.detail);
        return { ok: false, error: cause.code };
      }
      await fail("extract_empty", "We couldn't find readable text. Try a clearer scan.");
      return { ok: false, error: "extract_failed" };
    }

    // ---- chunk + embed + insert -------------------------------------------
    try {
      const inserted = await step.run("chunk-embed-insert", async () => {
        await broadcastJobEvent(materialId, { stage: "chunking", pct: 55 });
        const chunks = chunkBlocks(extracted.blocks);
        if (chunks.length === 0) {
          throw new ExtractError("extract_empty", "We couldn't find readable text. Try a clearer scan.");
        }
        const embeddings = await embedTexts(chunks.map((c) => c.content));
        await broadcastJobEvent(materialId, { stage: "embedding", pct: 80 });
        // Replace-don't-duplicate on retry; new artifacts only land when ready.
        await admin.from("chunks").delete().eq("material_id", materialId);
        const { error } = await admin.from("chunks").insert(
          chunks.map((c, i) => ({
            material_id: materialId,
            course_id: material.course_id,
            user_id: material.user_id,
            idx: c.idx,
            content: c.content,
            page: c.page,
            start_seconds: c.start_seconds,
            end_seconds: c.end_seconds,
            embedding: embeddings[i],
            token_count: c.token_count,
          }))
        );
        if (error) throw new Error(error.message);
        return chunks.length;
      });

      await step.run("finish", async () => {
        await admin
          .from("materials")
          .update({
            status: "ready",
            page_count: extracted.pageCount ?? null,
            duration_seconds: extracted.durationSeconds ?? null,
          })
          .eq("id", materialId);
        await broadcastJobEvent(materialId, { stage: "ready", pct: 100, chunks: inserted });
        await capturePostHog(material.user_id, "material_upload_succeeded", {
          kind: material.kind,
          chunks: inserted,
        });
      });
      return { ok: true, chunks: inserted };
    } catch (e) {
      const cause = unwrapExtractError(e);
      if (cause) {
        await fail(cause.code, cause.detail);
        return { ok: false, error: cause.code };
      }
      if (e instanceof Error && e.message === "openai_not_configured") {
        await fail("ai_overloaded", "Our AI is busy — retrying automatically."); // TODO(key-needed)
        return { ok: false, error: "openai_not_configured" };
      }
      throw e; // real infrastructure error → Inngest retries
    }
  }
);

/** Inngest step.run serializes thrown errors — recover ExtractError by shape. */
function unwrapExtractError(e: unknown): { code: string; detail: string } | null {
  if (e instanceof ExtractError) return { code: e.code, detail: e.detail };
  if (e && typeof e === "object") {
    const err = e as { name?: string; message?: string; cause?: unknown };
    const codes = [
      "file_too_large", "unsupported_format", "yt_unavailable", "yt_no_captions",
      "audio_too_long", "extract_empty",
    ];
    if (err.message && codes.includes(err.message)) {
      const cause = err.cause as { detail?: string } | undefined;
      return { code: err.message, detail: cause?.detail ?? DETAILS[err.message] ?? err.message };
    }
  }
  return null;
}

const DETAILS: Record<string, string> = {
  unsupported_format: "This file couldn't be read — try another format.",
  yt_unavailable: "This video is private or region-locked.",
  yt_no_captions: "This video has no captions — download the audio and upload it instead.",
  extract_empty: "We couldn't find readable text. Try a clearer scan.",
};
