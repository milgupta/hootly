import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { AuthScreen } from "../AuthScreen";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage() {
  const user = await getUser();
  if (user) redirect("/home");
  return <AuthScreen mode="login" />;
}
