import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { AuthScreen } from "../AuthScreen";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignupPage() {
  const user = await getUser();
  if (user) redirect("/home");
  return <AuthScreen mode="signup" />;
}
