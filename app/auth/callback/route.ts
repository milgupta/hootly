import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
          .select("onboarding_completed_at, deletion_requested_at")
          .eq("id", data.user.id)
          .maybeSingle();
        const dest = profile?.onboarding_completed_at ? "/home" : "/onboarding";
        return NextResponse.redirect(`${origin}${dest}?authed=1`);
      }
    }
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
