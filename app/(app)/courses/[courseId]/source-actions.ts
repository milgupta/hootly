"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/app/(app)/actions";

export interface SourceSegment {
  id: string;
  content: string;
  page: number | null;
  startSeconds: number | null;
}

export interface SourceView {
  materialTitle: string;
  kind: "document" | "media" | "text";
  page: number | null;
  segments: SourceSegment[];
  /** 60-minute signed URL to the original upload (docs/04 §4 storage). */
  originalUrl: string | null;
}

/** Fetch the source context around a cited chunk for the split-pane viewer.
 *  For paged documents: the whole page. For media: a transcript window. */
export async function getSourceForChunk(chunkId: string): Promise<ActionResult<SourceView>> {
  if (!z.string().uuid().safeParse(chunkId).success) return { ok: false, error: "Bad request." };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Not connected to a database yet." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };

  // RLS scopes this to the owner (chunks are Class B: own-read only).
  const { data: chunk } = await supabase
    .from("chunks")
    .select("id, material_id, idx, page, start_seconds")
    .eq("id", chunkId)
    .maybeSingle();
  if (!chunk) return { ok: false, error: "That source is no longer available." };

  const { data: material } = await supabase
    .from("materials")
    .select("id, title, kind, storage_path")
    .eq("id", chunk.material_id)
    .maybeSingle();
  if (!material) return { ok: false, error: "That source is no longer available." };

  const isMedia = chunk.start_seconds != null;
  let query = supabase
    .from("chunks")
    .select("id, content, page, start_seconds, idx")
    .eq("material_id", chunk.material_id)
    .order("idx");

  if (chunk.page != null) {
    query = query.eq("page", chunk.page);
  } else {
    // Window around the cited chunk for media/plain text.
    query = query.gte("idx", Math.max(0, chunk.idx - 4)).lte("idx", chunk.idx + 6);
  }
  const { data: segments } = await query;

  let originalUrl: string | null = null;
  if (material.storage_path) {
    const admin = createAdminClient();
    if (admin) {
      const { data: signed } = await admin.storage
        .from("materials")
        .createSignedUrl(material.storage_path, 3600);
      originalUrl = signed?.signedUrl ?? null;
    }
  }

  return {
    ok: true,
    data: {
      materialTitle: material.title,
      kind: isMedia ? "media" : material.storage_path ? "document" : "text",
      page: chunk.page,
      segments: (segments ?? []).map((s) => ({
        id: s.id as string,
        content: s.content as string,
        page: (s.page ?? null) as number | null,
        startSeconds: (s.start_seconds ?? null) as number | null,
      })),
      originalUrl,
    },
  };
}
