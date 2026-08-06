import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { getLiveCourses, getPlan, getProfile, getUsage } from "@/lib/data";
import { LIMITS } from "@/lib/billing/limits";
import { Sidebar } from "@/components/shell/Sidebar";
import { TopBar } from "@/components/shell/TopBar";
import { MobileTabs } from "@/components/shell/MobileTabs";
import { PaywallHost } from "@/components/billing/PaywallModal";
import { AnalyticsIdentify } from "@/components/analytics/AnalyticsIdentify";
import { RestoreAccountBanner } from "@/components/shell/RestoreAccountBanner";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login");

  const [profile, courses, plan, uploadsUsed] = await Promise.all([
    getProfile(user.id),
    getLiveCourses(user.id),
    getPlan(user.id),
    getUsage(user.id, "uploads"),
  ]);

  // Account scheduled for deletion → restore banner handled in settings; block app usage.
  const displayName =
    profile?.display_name || profile?.email?.split("@")[0] || "there";
  const courseNames = Object.fromEntries(courses.map((c) => [c.id, c.name]));

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar
        courses={courses.map((c) => ({ id: c.id, name: c.name, emoji: c.emoji }))}
        plan={plan}
        uploadsUsed={uploadsUsed}
        uploadsLimit={LIMITS.free.uploads}
        displayName={displayName}
        avatarUrl={profile?.avatar_url ?? null}
      />
      <div className="md:pl-[260px]">
        <TopBar
          displayName={displayName}
          avatarUrl={profile?.avatar_url ?? null}
          courseNames={courseNames}
        />
        <main className="mx-auto max-w-[1200px] px-4 pb-24 pt-6 md:px-6 md:pb-10">
          {profile?.deletion_requested_at && (
            <RestoreAccountBanner deletionRequestedAt={profile.deletion_requested_at} />
          )}
          {children}
        </main>
      </div>
      <MobileTabs firstCourseId={courses[0]?.id ?? null} />
      <PaywallHost />
      <AnalyticsIdentify
        userId={user.id}
        plan={plan}
        studyLevel={profile?.study_level ?? null}
        isEdu={profile?.is_edu ?? false}
      />
    </div>
  );
}
