import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser, createClient } from "@/lib/supabase/server";
import { getPlan, getUsage } from "@/lib/data";
import { OnboardingFlow } from "./OnboardingFlow";
import type { Course, Profile } from "@/lib/types";

export const metadata: Metadata = { title: "Get started" };

const STEPS = ["who", "level", "course", "materials", "calibrate", "building"] as const;
type Step = (typeof STEPS)[number];

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; course?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");
  const { step, course: courseParam } = await searchParams;

  const supabase = await createClient();
  const [{ data: profile }, { data: courses }, plan, uploadsUsed] = await Promise.all([
    supabase
      ? supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      ? supabase
          .from("courses")
          .select("*")
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(1)
      : Promise.resolve({ data: [] }),
    getPlan(user.id),
    getUsage(user.id, "uploads"),
  ]);

  const activeCourse =
    (courses ?? []).find((c) => c.id === courseParam) ?? (courses ?? [])[0] ?? null;

  return (
    <OnboardingFlow
      initialStep={STEPS.includes(step as Step) ? (step as Step) : "who"}
      profile={(profile ?? null) as Profile | null}
      course={(activeCourse ?? null) as Course | null}
      plan={plan}
      uploadsUsed={uploadsUsed}
    />
  );
}
