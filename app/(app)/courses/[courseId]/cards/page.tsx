import { notFound, redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import { getPlan, getUsage } from "@/lib/data";
import { CardsManager } from "./CardsManager";
import type { Course, Flashcard } from "@/lib/types";

/** Flashcards manage screen (docs/05 §7.2). */
export default async function CardsPage({
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

  const [cardsRes, plan, cardsGenerated] = await Promise.all([
    supabase
      .from("flashcards")
      .select("*")
      .eq("course_id", courseId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    getPlan(user.id),
    getUsage(user.id, "cards_generated"),
  ]);

  return (
    <CardsManager
      course={course as Course}
      cards={(cardsRes.data ?? []) as Flashcard[]}
      plan={plan}
      cardsGenerated={cardsGenerated}
    />
  );
}
