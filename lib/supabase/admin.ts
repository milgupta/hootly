import "server-only";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, hasServiceRoleEnv } from "@/lib/env";

let adminClient: SupabaseClient | null = null;

/** Service-role client — server code and jobs ONLY (bypasses RLS).
 *  Null when SUPABASE_SERVICE_ROLE_KEY is missing. */
export function createAdminClient(): SupabaseClient | null {
  // TODO(key-needed): remove the guard once SUPABASE_SERVICE_ROLE_KEY is set.
  if (!hasServiceRoleEnv) return null;
  if (!adminClient) {
    adminClient = createSupabaseClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return adminClient;
}
