import { notFound, redirect } from "next/navigation";
import { getUser, createClient } from "@/lib/supabase/server";
import { getPlan } from "@/lib/data";
import { NoteReader } from "./NoteReader";
import type { Note, NoteSection } from "@/lib/types";
import type { SourceChipData } from "@/components/ui/SourceChip";

export default async function NotePage({
  params,
}: {
  params: Promise<{ courseId: string; noteId: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");
  const { courseId, noteId } = await params;

  const supabase = await createClient();
  if (!supabase) notFound();

  const { data: note } = await supabase
    .from("notes")
    .select("*")
    .eq("id", noteId)
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!note) notFound();

  const [{ data: sections }, plan] = await Promise.all([
    supabase.from("note_sections").select("*").eq("note_id", noteId).order("idx"),
    getPlan(user.id),
  ]);

  // Resolve each section's cited chunks into source chips (material + locator).
  const allChunkIds = [
    ...new Set(((sections ?? []) as NoteSection[]).flatMap((s) => s.source_chunk_ids)),
  ];
  const chipsByChunk: Record<string, SourceChipData> = {};
  if (allChunkIds.length > 0) {
    const { data: chunks } = await supabase
      .from("chunks")
      .select("id, material_id, page, start_seconds")
      .in("id", allChunkIds);
    const materialIds = [...new Set((chunks ?? []).map((c) => c.material_id as string))];
    const { data: materials } = await supabase
      .from("materials")
      .select("id, title")
      .in("id", materialIds);
    const titles = new Map((materials ?? []).map((m) => [m.id as string, m.title as string]));
    for (const c of chunks ?? []) {
      chipsByChunk[c.id as string] = {
        chunkId: c.id as string,
        materialTitle: titles.get(c.material_id as string) ?? "Material",
        page: (c.page ?? null) as number | null,
        startSeconds: (c.start_seconds ?? null) as number | null,
      };
    }
  }

  return (
    <NoteReader
      note={note as Note}
      sections={(sections ?? []) as NoteSection[]}
      chipsByChunk={chipsByChunk}
      plan={plan}
      courseId={courseId}
    />
  );
}
