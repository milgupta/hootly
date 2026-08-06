"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

export interface AuthResult {
  ok: boolean;
  error?: string;
  sentTo?: string;
}

const emailSchema = z.string().trim().email();

export async function signInWithGoogle(): Promise<AuthResult> {
  const supabase = await createClient();
  if (!supabase) {
    // TODO(key-needed): Supabase env missing — auth is fully wired, only this entry is stubbed.
    return { ok: false, error: "Sign-in isn't configured yet on this deployment." };
  }
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${env.appUrl}/auth/callback`,
      queryParams: { access_type: "offline", prompt: "select_account" },
    },
  });
  if (error) return { ok: false, error: error.message };
  if (data.url) redirect(data.url);
  return { ok: true };
}

export async function signInWithMagicLink(formData: FormData): Promise<AuthResult> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { ok: false, error: "Enter a valid email address." };
  const email = parsed.data;

  const supabase = await createClient();
  if (!supabase) {
    // TODO(key-needed): Supabase env missing — auth is fully wired, only this entry is stubbed.
    return { ok: false, error: "Sign-in isn't configured yet on this deployment." };
  }
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${env.appUrl}/auth/callback` },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, sentTo: email };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/login");
}
