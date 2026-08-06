import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

/** Soft-delete semantics (docs/04 §4, normative):
 *  - Deleting a course stamps deleted_at on the course AND all children in one pass
 *    with the SAME timestamp. (note_sections/quiz_questions/study_plan_items have no
 *    deleted_at column in doc 04's schema — they're gated by their parent row.)
 *  - Trash lists top-level items only (cascade children hidden behind their course row).
 *  - Restoring an item restores it and its cascade group (matching timestamp); restoring
 *    a child whose parent course is deleted restores the parent course too; children
 *    separately deleted earlier keep their own deleted_at.
 *  - Nightly purge hard-deletes rows (and storage objects) past 30 days. */

export type TrashKind = "course" | "material" | "note" | "flashcard" | "quiz" | "thread";

const CHILD_TABLES = ["materials", "notes", "flashcards", "quizzes", "chat_threads"] as const;

const KIND_TABLE: Record<TrashKind, string> = {
  course: "courses",
  material: "materials",
  note: "notes",
  flashcard: "flashcards",
  quiz: "quizzes",
  thread: "chat_threads",
};

export function tableFor(kind: TrashKind): string {
  return KIND_TABLE[kind];
}

export async function softDeleteResource(
  kind: TrashKind,
  id: string,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Not configured." };
  const ts = new Date().toISOString();

  if (kind === "course") {
    const { data: course, error } = await admin
      .from("courses")
      .update({ deleted_at: ts })
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error || !course) return { ok: false, error: "Course not found." };
    for (const table of CHILD_TABLES) {
      await admin
        .from(table)
        .update({ deleted_at: ts })
        .eq("course_id", id)
        .eq("user_id", userId)
        .is("deleted_at", null);
    }
    return { ok: true };
  }

  const { data, error } = await admin
    .from(tableFor(kind))
    .update({ deleted_at: ts })
    .eq("id", id)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Item not found." };
  return { ok: true };
}

export async function restoreResource(
  kind: TrashKind,
  id: string,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Not configured." };

  if (kind === "course") {
    return restoreCourseGroup(admin, id, userId);
  }

  const table = tableFor(kind);
  const { data: row, error } = await admin
    .from(table)
    .select("id, course_id, deleted_at")
    .eq("id", id)
    .eq("user_id", userId)
    .not("deleted_at", "is", null)
    .maybeSingle();
  if (error || !row) return { ok: false, error: "Item not found in Trash." };

  await admin.from(table).update({ deleted_at: null }).eq("id", id).eq("user_id", userId);

  // Parent course also deleted → restore its cascade group too.
  const { data: course } = await admin
    .from("courses")
    .select("id, deleted_at")
    .eq("id", row.course_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (course?.deleted_at) {
    await restoreCourseGroup(admin, course.id, userId);
  }
  return { ok: true };
}

async function restoreCourseGroup(
  admin: SupabaseClient,
  courseId: string,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const { data: course, error } = await admin
    .from("courses")
    .select("id, deleted_at")
    .eq("id", courseId)
    .eq("user_id", userId)
    .not("deleted_at", "is", null)
    .maybeSingle();
  if (error || !course) return { ok: false, error: "Course not found in Trash." };
  const ts = course.deleted_at as string;
  await admin.from("courses").update({ deleted_at: null }).eq("id", courseId).eq("user_id", userId);
  for (const table of CHILD_TABLES) {
    // Only the cascade group (matching timestamp) — separately deleted children stay in Trash.
    await admin
      .from(table)
      .update({ deleted_at: null })
      .eq("course_id", courseId)
      .eq("user_id", userId)
      .eq("deleted_at", ts);
  }
  return { ok: true };
}

export interface TrashRow {
  id: string;
  kind: TrashKind;
  title: string;
  courseName: string | null;
  deletedAt: string;
}

/** Top-level trash rows: deleted courses as one row each; children only when
 *  individually deleted (their timestamp differs from their course's). */
export async function listTrash(userId: string): Promise<TrashRow[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const rows: TrashRow[] = [];

  const { data: courses } = await admin
    .from("courses")
    .select("id, name, deleted_at")
    .eq("user_id", userId)
    .not("deleted_at", "is", null);
  const courseTs = new Map<string, string>();
  const courseNames = new Map<string, string>();
  for (const c of courses ?? []) {
    courseTs.set(c.id, c.deleted_at);
    courseNames.set(c.id, c.name);
    rows.push({ id: c.id, kind: "course", title: c.name, courseName: null, deletedAt: c.deleted_at });
  }

  const { data: liveCourses } = await admin
    .from("courses")
    .select("id, name")
    .eq("user_id", userId)
    .is("deleted_at", null);
  for (const c of liveCourses ?? []) courseNames.set(c.id, c.name);

  const childSpecs: { table: string; kind: TrashKind; titleCol: string }[] = [
    { table: "materials", kind: "material", titleCol: "title" },
    { table: "notes", kind: "note", titleCol: "title" },
    { table: "flashcards", kind: "flashcard", titleCol: "front" },
    { table: "quizzes", kind: "quiz", titleCol: "title" },
    { table: "chat_threads", kind: "thread", titleCol: "title" },
  ];
  for (const spec of childSpecs) {
    const { data } = await admin
      .from(spec.table)
      .select(`id, course_id, deleted_at, ${spec.titleCol}`)
      .eq("user_id", userId)
      .not("deleted_at", "is", null);
    for (const row of (data ?? []) as unknown as Array<Record<string, string>>) {
      const cascadeTs = courseTs.get(row.course_id ?? "");
      if (cascadeTs && cascadeTs === row.deleted_at) continue; // hidden behind course row
      rows.push({
        id: row.id as string,
        kind: spec.kind,
        title: (row[spec.titleCol] as string) ?? "Untitled",
        courseName: courseNames.get(row.course_id ?? "") ?? null,
        deletedAt: row.deleted_at as string,
      });
    }
  }

  rows.sort((a, b) => (a.deletedAt < b.deletedAt ? 1 : -1));
  return rows;
}

/** Hard-delete all of a user's trashed rows now ("Empty trash", double-confirmed in UI). */
export async function emptyTrashNow(userId: string): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Not configured." };
  await hardDeleteTrashed(admin, userId, null);
  return { ok: true };
}

/** Hard-delete trashed rows (optionally only those older than `olderThanIso`),
 *  removing storage objects for materials first. FK cascades handle children. */
export async function hardDeleteTrashed(
  admin: SupabaseClient,
  userId: string | null,
  olderThanIso: string | null
): Promise<void> {
  // Storage objects for trashed materials.
  let matQuery = admin
    .from("materials")
    .select("id, storage_path")
    .not("deleted_at", "is", null)
    .not("storage_path", "is", null);
  if (userId) matQuery = matQuery.eq("user_id", userId);
  if (olderThanIso) matQuery = matQuery.lt("deleted_at", olderThanIso);
  const { data: mats } = await matQuery;
  const paths = (mats ?? []).map((m) => m.storage_path as string).filter(Boolean);
  if (paths.length > 0) {
    await admin.storage.from("materials").remove(paths);
  }

  for (const table of ["chat_threads", "quizzes", "flashcards", "notes", "materials", "courses"]) {
    let q = admin.from(table).delete().not("deleted_at", "is", null);
    if (userId) q = q.eq("user_id", userId);
    if (olderThanIso) q = q.lt("deleted_at", olderThanIso);
    await q;
  }
}
