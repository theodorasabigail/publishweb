import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import type { Profile } from "@/lib/types";

/**
 * Granting the very first admin.
 *
 * Chicken and egg: every admin after the first is a button in Admin →
 * Customers, but there is nobody to press it the first time. The usual answer
 * is "run one UPDATE in Supabase", which is fine for a developer and a wall
 * for everyone else — and it fails silently in the one case that matters most,
 * an account created before the profiles trigger existed, where there is no
 * row to update and the statement reports success on zero rows.
 *
 * So the bootstrap is an environment variable instead, set in the same place
 * as every other setting. Sign in as that address and the account is promoted,
 * profile row created if it is missing.
 *
 * The trust here is exactly the trust already placed in the environment: the
 * only person who can name the address is the person who can already read the
 * service-role key sitting next to it. Once you are in, clear the variable —
 * it is a one-time key, not a standing grant.
 */
export async function bootstrapAdmin(input: {
  userId: string;
  email: string | null;
}): Promise<Profile | null> {
  const configured = env.optional("ADMIN_BOOTSTRAP_EMAIL")?.trim().toLowerCase();
  if (!configured || !input.email) return null;
  if (configured !== input.email.trim().toLowerCase()) return null;

  try {
    const { data, error } = await createAdminClient()
      .from("profiles")
      // Upsert rather than update, so an account that predates the profiles
      // trigger gets a row instead of matching nothing. Only these three
      // columns are written, so loyalty points and display name survive.
      .upsert(
        { id: input.userId, email: input.email, is_admin: true },
        { onConflict: "id" },
      )
      .select("*")
      .single();

    if (error) {
      console.error("admin bootstrap failed", error);
      return null;
    }

    console.info(`admin bootstrap: promoted ${input.email}`);
    return data as Profile;
  } catch (error) {
    // Almost always a missing SUPABASE_SERVICE_ROLE_KEY. Refusing entry is the
    // right outcome; crashing the page on the way is not.
    console.error("admin bootstrap could not run", error);
    return null;
  }
}
