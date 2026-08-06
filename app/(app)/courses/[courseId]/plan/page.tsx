import { notFound, redirect } from "next/navigation";
import { getUser, createClient } from "@/lib/supabase/server";
import { PlanScreen } from "./PlanScreen";
import type { Course, StudyPlanItem } from "@/lib/types";

export default async function PlanPage({
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

  const [{ data: items }, { data: notes }, { data: quizzes }] = await Promise.all([
    supabase
      .from("study_plan_items")
      .select("*")
      .eq("course_id", courseId)
      .order("due_date", { ascending: true })
      .order("idx", { ascending: true }),
    supabase.from("notes").select("id, title").eq("course_id", courseId).is("deleted_at", null),
    supabase.from("quizzes").select("id, title, kind").eq("course_id", courseId).is("deleted_at", null),
  ]);

  return (
    <PlanScreen
      course={course as Course}
      items={(items ?? []) as (StudyPlanItem & { moved_from?: string | null })[]}
      notes={(notes ?? []) as { id: string; title: string }[]}
      quizzes={(quizzes ?? []) as { id: string; title: string; kind: string }[]}
    />
  );
}
