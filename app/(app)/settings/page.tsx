import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { getAllUsage, getProfile, getSubscription } from "@/lib/data";
import { SettingsScreen } from "./SettingsScreen";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");
  const { tab } = await searchParams;
  const [profile, subscription, usage] = await Promise.all([
    getProfile(user.id),
    getSubscription(user.id),
    getAllUsage(user.id),
  ]);
  return (
    <SettingsScreen
      initialTab={
        tab === "billing" || tab === "usage" || tab === "privacy" ? tab : "account"
      }
      profile={profile}
      subscription={subscription}
      usage={usage}
      email={user.email ?? ""}
    />
  );
}
