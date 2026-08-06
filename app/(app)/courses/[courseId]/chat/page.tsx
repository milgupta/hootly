import { notFound, redirect } from "next/navigation";
import { getUser, createClient } from "@/lib/supabase/server";
import { getPlan, getUsage } from "@/lib/data";
import { TutorScreen } from "./TutorScreen";
import type { ChatMessage, ChatThread, Course } from "@/lib/types";

export default async function ChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ thread?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");
  const { courseId } = await params;
  const { thread: threadParam } = await searchParams;

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

  const [{ data: threads }, plan, tutorUsed, { data: sections }] = await Promise.all([
    supabase
      .from("chat_threads")
      .select("*")
      .eq("course_id", courseId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false }),
    getPlan(user.id),
    getUsage(user.id, "tutor_messages"),
    supabase
      .from("note_sections")
      .select("heading, notes!inner(course_id)")
      .eq("notes.course_id", courseId)
      .limit(3),
  ]);

  const activeThread =
    (threads ?? []).find((t) => t.id === threadParam) ?? (threads ?? [])[0] ?? null;

  let messages: ChatMessage[] = [];
  if (activeThread) {
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("thread_id", activeThread.id)
      .order("created_at", { ascending: true });
    messages = (data ?? []) as ChatMessage[];
  }

  const suggestions = (sections ?? [])
    .map((s) => `Explain ${s.heading as string} in simple terms`)
    .slice(0, 3);

  return (
    <TutorScreen
      course={course as Course}
      threads={(threads ?? []) as ChatThread[]}
      activeThread={activeThread as ChatThread | null}
      messages={messages}
      plan={plan}
      tutorUsed={tutorUsed}
      suggestions={suggestions}
    />
  );
}
