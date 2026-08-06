"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendInngestEvent } from "@/lib/inngest-send";
import { checkQuota, incrementUsage } from "@/lib/billing/usage";
import { capturePostHog } from "@/lib/analytics/server";
import { parseYouTubeId } from "@/lib/extract/youtube";
import type { ActionResult } from "@/app/(app)/actions";
import { kindForFilename, MAX_UPLOAD_BYTES as MAX_BYTES } from "@/lib/upload";

async function requireUser() {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

async function assertCourseOwned(courseId: string, userId: string): Promise<boolean> {
  const supabase = await createClient();
  if (!supabase) return false;
  const { data } = await supabase
    .from("courses")
    .select("id")
    .eq("id", courseId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  return Boolean(data);
}

/** Step 1 of the signed-URL upload flow: validate + create material row + signed URL.
 *  Quota is checked server-side BEFORE anything is created (docs/04 §5). */
export async function requestUpload(input: {
  courseId: string;
  filename: string;
  byteSize: number;
  metered?: boolean;
}): Promise<ActionResult<{ materialId: string; path: string; token: string }>> {
  const schema = z.object({
    courseId: z.string().uuid(),
    filename: z.string().min(1).max(300),
    byteSize: z.number().int().positive(),
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Bad request." };
  const user = await requireUser();
  if (!user) return { ok: false, error: "Sign in first." };
  if (!(await assertCourseOwned(input.courseId, user.id)))
    return { ok: false, error: "Course not found." };

  const kind = kindForFilename(input.filename);
  if (!kind) {
    return { ok: false, code: "unsupported_format", error: "This file type isn't supported — see the list of formats we read." };
  }
  if (input.byteSize > MAX_BYTES) {
    const mb = Math.round(input.byteSize / 1024 / 1024);
    return { ok: false, code: "file_too_large", error: `Max 100MB — this file is ${mb}MB.` };
  }

  const quota = await checkQuota(user.id, "uploads");
  if (!quota.allowed) {
    await capturePostHog(user.id, "limit_hit", { metric: "uploads" });
    return { ok: false, code: "limit_reached", error: "Upload limit reached." };
  }

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Uploads aren't configured yet on this deployment." };

  const { data: material, error } = await admin
    .from("materials")
    .insert({
      course_id: input.courseId,
      user_id: user.id,
      kind,
      title: input.filename.replace(/\.[^.]+$/, ""),
      byte_size: input.byteSize,
      status: "queued",
    })
    .select("id")
    .single();
  if (error || !material) return { ok: false, error: "Couldn't start the upload — try again." };

  const ext = input.filename.split(".").pop()?.toLowerCase() ?? "bin";
  const path = `${user.id}/${material.id}/original.${ext}`;
  await admin.from("materials").update({ storage_path: path }).eq("id", material.id);

  const { data: signed, error: signError } = await admin.storage
    .from("materials")
    .createSignedUploadUrl(path);
  if (signError || !signed) return { ok: false, error: "Couldn't start the upload — try again." };

  await capturePostHog(user.id, "material_upload_started", { kind, bytes: input.byteSize });
  return { ok: true, data: { materialId: material.id, path, token: signed.token } };
}

/** Step 2: after the client PUTs the file, enqueue ingestion + count the upload. */
export async function confirmUpload(materialId: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(materialId).success) return { ok: false, error: "Bad request." };
  const user = await requireUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Not configured." };
  const { data: material } = await admin
    .from("materials")
    .select("id, user_id, course_id")
    .eq("id", materialId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!material) return { ok: false, error: "Upload not found." };

  await incrementUsage(user.id, "uploads");
  await sendInngestEvent({ name: "material/uploaded", data: { materialId } });
  revalidatePath(`/courses/${material.course_id}`);
  return { ok: true };
}

/** Non-file materials: pasted notes / YouTube link / Quizlet export / topic.
 *  All except 'topic' count toward the uploads quota (topic is the escape hatch). */
export async function addNonFileMaterial(input: {
  courseId: string;
  kind: "pasted" | "youtube" | "quizlet" | "topic";
  title?: string;
  text?: string;
  url?: string;
}): Promise<ActionResult<{ materialId: string }>> {
  const schema = z.object({
    courseId: z.string().uuid(),
    kind: z.enum(["pasted", "youtube", "quizlet", "topic"]),
    title: z.string().trim().max(200).optional(),
    text: z.string().max(500_000).optional(),
    url: z.string().trim().max(500).optional(),
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Bad request." };
  const user = await requireUser();
  if (!user) return { ok: false, error: "Sign in first." };
  if (!(await assertCourseOwned(input.courseId, user.id)))
    return { ok: false, error: "Course not found." };

  const { kind } = parsed.data;

  if (kind !== "topic") {
    const quota = await checkQuota(user.id, "uploads");
    if (!quota.allowed) {
      await capturePostHog(user.id, "limit_hit", { metric: "uploads" });
      return { ok: false, code: "limit_reached", error: "Upload limit reached." };
    }
  }
  if ((kind === "pasted" || kind === "quizlet") && !parsed.data.text?.trim()) {
    return { ok: false, error: "Paste something first." };
  }
  if (kind === "youtube") {
    if (!parsed.data.url || !parseYouTubeId(parsed.data.url)) {
      return { ok: false, code: "yt_unavailable", error: "That doesn't look like a YouTube link." };
    }
  }

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Not configured." };

  const titles: Record<typeof kind, string> = {
    pasted: parsed.data.title || "Pasted notes",
    quizlet: parsed.data.title || "Quizlet import",
    youtube: "YouTube video",
    topic: parsed.data.title || "Topic",
  };

  const { data: material, error } = await admin
    .from("materials")
    .insert({
      course_id: input.courseId,
      user_id: user.id,
      kind,
      title: titles[kind],
      raw_text: kind === "pasted" || kind === "quizlet" ? parsed.data.text : null,
      source_url: kind === "youtube" ? parsed.data.url : null,
      status: "queued",
    })
    .select("id")
    .single();
  if (error || !material) return { ok: false, error: "Couldn't add that — try again." };

  if (kind !== "topic") await incrementUsage(user.id, "uploads");
  await capturePostHog(user.id, "material_upload_started", { kind });
  await sendInngestEvent({ name: "material/uploaded", data: { materialId: material.id } });
  revalidatePath(`/courses/${input.courseId}`);
  return { ok: true, data: { materialId: material.id } };
}

/** Retry a failed material: reset + re-enqueue (no new quota charge). */
export async function retryMaterial(materialId: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(materialId).success) return { ok: false, error: "Bad request." };
  const user = await requireUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Not configured." };
  const { data: material } = await admin
    .from("materials")
    .select("id, course_id")
    .eq("id", materialId)
    .eq("user_id", user.id)
    .eq("status", "failed")
    .maybeSingle();
  if (!material) return { ok: false, error: "Nothing to retry." };
  await admin
    .from("materials")
    .update({ status: "queued", error_code: null, error_detail: null })
    .eq("id", materialId);
  await sendInngestEvent({ name: "material/uploaded", data: { materialId } });
  revalidatePath(`/courses/${material.course_id}`);
  return { ok: true };
}

/** Course mutations (header menu). */
export async function updateCourse(input: {
  courseId: string;
  name?: string;
  examDate?: string | null;
  familiarity?: "new" | "some" | "well";
}): Promise<ActionResult> {
  const schema = z.object({
    courseId: z.string().uuid(),
    name: z.string().trim().min(1).max(120).optional(),
    examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    familiarity: z.enum(["new", "some", "well"]).optional(),
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Bad request." };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Not configured." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };

  const patch: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.examDate !== undefined) patch.exam_date = parsed.data.examDate;
  if (parsed.data.familiarity !== undefined) patch.familiarity = parsed.data.familiarity;
  const { error } = await supabase
    .from("courses")
    .update(patch)
    .eq("id", parsed.data.courseId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: "Couldn't save — try again." };
  revalidatePath(`/courses/${parsed.data.courseId}`);
  revalidatePath("/home");
  return { ok: true };
}

export async function archiveCourse(courseId: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(courseId).success) return { ok: false, error: "Bad request." };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Not configured." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const { error } = await supabase
    .from("courses")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", courseId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: "Couldn't archive — try again." };
  revalidatePath("/home");
  return { ok: true };
}
