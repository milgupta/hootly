import { notFound, redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import { ReviewSession } from "./ReviewSession";
import type { Course, Flashcard } from "@/lib/types";
import type { SourceChipData } from "@/components/ui/SourceChip";

/** Review session (docs/05 §7.3): due cards only — fsrs_due <= now,
 *  not suspended, not deleted. */
export default async function ReviewPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");
  const { courseId } = await params;

  const supabase = await createClient();
  if (!supabase) notFound();

  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!course) notFound();

  const { data: dueRows } = await supabase
    .from("flashcards")
    .select("*")
    .eq("course_id", courseId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .eq("suspended", false)
    .lte("fsrs_due", new Date().toISOString())
    .order("fsrs_due", { ascending: true });

  const cards = (dueRows ?? []) as Flashcard[];

  // Resolve each card's first cited chunk into the source chip on the card back.
  const chunkIds = [...new Set(cards.flatMap((c) => c.source_chunk_ids ?? []))];
  const chipsByChunk: Record<string, SourceChipData> = {};
  if (chunkIds.length > 0) {
    const { data: chunks } = await supabase
      .from("chunks")
      .select("id, material_id, page, start_seconds")
      .in("id", chunkIds);
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
    <ReviewSession course={course as Course} cards={cards} chipsByChunk={chipsByChunk} />
  );
}
