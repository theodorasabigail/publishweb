import "server-only";
import { getSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Every admin mutation starts here.
 *
 * The check is on the caller's session; the client returned is service-role so
 * the operator's edits are not fighting Row Level Security on every write. If
 * the caller is not an admin, nothing downstream runs.
 */
export async function adminClient() {
  const session = await getSession();
  if (!session?.profile?.is_admin) {
    throw new Error("Not authorised.");
  }
  return { supabase: createAdminClient(), session };
}

export function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export function optionalText(formData: FormData, key: string): string | null {
  const value = text(formData, key);
  return value.length ? value : null;
}

export function integer(formData: FormData, key: string, fallback = 0): number {
  const value = Number(formData.get(key));
  return Number.isFinite(value) ? Math.round(value) : fallback;
}

export function optionalInteger(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.round(value) : null;
}

export function boolean(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return value === "on" || value === "true" || value === "1";
}

/**
 * Turn a Postgres error into something the operator can act on.
 *
 * Server actions that throw surface in the browser as "Minified React error
 * #441" — React hides the message in production so a database error cannot
 * leak table names to the public. Correct, but useless to the one person who
 * needs to know, so the messages that matter are translated here instead.
 *
 * By far the most common cause is a database that is behind the code: a
 * migration adds a column, the site deploys, and the SQL has not been run yet.
 * Postgres says 42703; the operator needs to be told to paste setup.sql.
 */
export function describeDbError(
  error: { code?: string; message?: string } | null,
  fallback: string,
): string {
  if (!error) return fallback;

  if (error.code === "42703" || error.code === "42P01") {
    return (
      "Your database is missing something this version of the site expects. " +
      "Open Supabase → SQL Editor, paste the contents of supabase/setup.sql " +
      "and run it, then try again. That file is structure only — it contains " +
      "no coffees, prices or writing, so it cannot overwrite anything."
    );
  }

  if (error.code === "23505") return "Something with that name or address already exists.";
  if (error.code === "23514") return "One of those values is outside what is allowed.";
  if (error.code === "23503") return "That refers to something that no longer exists.";

  return fallback;
}
