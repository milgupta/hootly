import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { env, hasSupabaseEnv } from "@/lib/env";

/** Server client bound to the request's cookies (RLS as the signed-in user).
 *  Returns null when Supabase env is missing — callers treat that as signed out. */
export async function createClient(): Promise<SupabaseClient | null> {
  // TODO(key-needed): remove the guard once NEXT_PUBLIC_SUPABASE_URL/ANON_KEY are set.
  if (!hasSupabaseEnv) return null;
  const cookieStore = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component — safe to ignore when middleware refreshes sessions.
        }
      },
    },
  });
}

export async function getUser(): Promise<User | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
