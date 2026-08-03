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
