import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { capturePostHog } from "@/lib/analytics/server";

/** OAuth / magic-link callback: exchange code, then land on onboarding or home.
 *  The redirect target prefetches the onboarding shell so post-OAuth paint is
 *  instant (docs/07 §3); auth_paint_measured is captured client-side. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    if (supabase) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error && data.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarding_completed_at, deletion_requested_at, is_edu")
          .eq("id", data.user.id)
          .maybeSingle();

        // signup_completed fires after FIRST auth only (docs/07 §2.2). A brand-new
        // user's created_at and last_sign_in_at are within seconds of each other.
        const createdAt = new Date(data.user.created_at).getTime();
        const lastSignIn = data.user.last_sign_in_at
          ? new Date(data.user.last_sign_in_at).getTime()
          : createdAt;
        if (Math.abs(lastSignIn - createdAt) < 10_000) {
          await capturePostHog(data.user.id, "signup_completed", {
            method: data.user.app_metadata?.provider === "google" ? "google" : "magic_link",
            is_edu: profile?.is_edu ?? false,
          });
        }

        const dest = profile?.onboarding_completed_at ? "/home" : "/onboarding";
        return NextResponse.redirect(`${origin}${dest}?authed=1`);
      }
    }
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
