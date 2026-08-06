"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env, hasSupabaseEnv } from "@/lib/env";

let client: SupabaseClient | null = null;

/** Browser client (singleton). Null when Supabase env is missing. */
export function createClient(): SupabaseClient | null {
  // TODO(key-needed): remove the guard once NEXT_PUBLIC_SUPABASE_URL/ANON_KEY are set.
  if (!hasSupabaseEnv) return null;
  if (!client) {
    client = createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
  }
  return client;
}
