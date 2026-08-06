"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  emptyTrashNow,
  restoreResource,
  softDeleteResource,
  type TrashKind,
} from "@/lib/trash";
import type { ActionResult } from "@/app/(app)/actions";

const kindSchema = z.enum(["course", "material", "note", "flashcard", "quiz", "thread"]);
const idSchema = z.string().uuid();

async function requireUser() {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function softDelete(kind: TrashKind, id: string): Promise<ActionResult> {
  if (!kindSchema.safeParse(kind).success || !idSchema.safeParse(id).success)
    return { ok: false, error: "Bad request." };
  const user = await requireUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const res = await softDeleteResource(kind, id, user.id);
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function restore(kind: TrashKind, id: string): Promise<ActionResult> {
  if (!kindSchema.safeParse(kind).success || !idSchema.safeParse(id).success)
    return { ok: false, error: "Bad request." };
  const user = await requireUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const res = await restoreResource(kind, id, user.id);
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function emptyTrash(): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const res = await emptyTrashNow(user.id);
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/trash");
  return { ok: true };
}
