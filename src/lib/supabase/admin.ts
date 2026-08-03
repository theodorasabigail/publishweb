import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Service-role client. Bypasses Row Level Security entirely.
 *
 * Only ever import this from server-side code that has already authorised the
 * caller: payment webhooks, order creation, and admin mutations. Never from a
 * component that renders in the browser.
 */
export function createAdminClient() {
  return createSupabaseClient(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
