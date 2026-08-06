import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import {
  getCourseDashboardStats,
  getDueCards,
  getLiveCourses,
  getPlan,
  getProfile,
  getTodayPlanItems,
} from "@/lib/data";
import { HomeDashboard } from "./HomeDashboard";

export const metadata: Metadata = { title: "Home" };

export default async function HomePage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const [profile, courses, plan, todayItems, dueCards] = await Promise.all([
    getProfile(user.id),
    getLiveCourses(user.id),
    getPlan(user.id),
    getTodayPlanItems(user.id),
    getDueCards(user.id),
  ]);
  const courseStats = await getCourseDashboardStats(
    user.id,
    courses.map((c) => c.id)
  );
  return (
    <HomeDashboard
      firstName={profile?.display_name?.split(" ")[0] || profile?.email?.split("@")[0] || "there"}
      courses={courses}
      plan={plan}
      todayItems={todayItems}
      dueCards={dueCards}
      courseStats={courseStats}
    />
  );
}
