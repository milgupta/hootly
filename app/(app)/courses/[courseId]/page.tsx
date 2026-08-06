import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import { getPlan, getUsage } from "@/lib/data";
import { CourseScreen } from "./CourseScreen";
import type { Course, Flashcard, Material, Note, Quiz, StudyPlanItem } from "@/lib/types";

export default async function CoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ tab?: string; add?: string; firstvalue?: string; warmup?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");
  const { courseId } = await params;
  const { tab, add, firstvalue, warmup } = await searchParams;

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

  const [materialsRes, notesRes, quizzesRes, cardsRes, planRes, plan, uploadsUsed] =
    await Promise.all([
      supabase
        .from("materials")
        .select("*")
        .eq("course_id", courseId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("notes")
        .select("*")
        .eq("course_id", courseId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("quizzes")
        .select("*")
        .eq("course_id", courseId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("flashcards")
        .select("id, fsrs_state, fsrs_scheduled_days, fsrs_due, suspended")
        .eq("course_id", courseId)
        .is("deleted_at", null),
      supabase
        .from("study_plan_items")
        .select("*")
        .eq("course_id", courseId)
        .order("due_date", { ascending: true })
        .order("idx", { ascending: true }),
      getPlan(user.id),
      getUsage(user.id, "uploads"),
    ]);

  return (
    <CourseScreen
      course={course as Course}
      materials={(materialsRes.data ?? []) as Material[]}
      notes={(notesRes.data ?? []) as Note[]}
      quizzes={(quizzesRes.data ?? []) as Quiz[]}
      cards={(cardsRes.data ?? []) as Pick<Flashcard, "id" | "fsrs_state" | "fsrs_scheduled_days" | "fsrs_due" | "suspended">[]}
      planItems={(planRes.data ?? []) as StudyPlanItem[]}
      plan={plan}
      uploadsUsed={uploadsUsed}
      initialTab={tab}
      autoOpenAdd={add === "1"}
      firstValue={firstvalue === "1"}
      warmupQuizId={warmup ?? null}
    />
  );
}
