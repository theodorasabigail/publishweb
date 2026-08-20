import { redirect } from "next/navigation";
import { bootstrapAdmin } from "@/lib/admin-bootstrap";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export interface SessionContext {
  userId: string;
  email: string | null;
  profile: Profile | null;
}

/** The signed-in user and their profile, or null for anonymous visitors. */
export async function getSession(): Promise<SessionContext | null> {
  // Before the first deploy is configured there is no auth to consult, and a
  // thrown "missing env var" here would take every page down with it.
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return {
    userId: user.id,
    email: user.email ?? null,
    profile: (profile as Profile | null) ?? null,
  };
}

/** Gate for /account. Sends anonymous visitors to login and back again. */
export async function requireUser(returnTo = "/account"): Promise<SessionContext> {
  const session = await getSession();
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  }
  return session;
}

/** Gate for /admin. A signed-in non-admin gets a 404-ish bounce rather than a
 *  message confirming the admin area exists. */
export async function requireAdmin(returnTo = "/admin"): Promise<SessionContext> {
  const session = await getSession();
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  }
  if (!session.profile?.is_admin) {
    // Before refusing, check whether this is the account named as the first
    // admin. Only reached when the caller is not already an admin, so it costs
    // nothing on any normal request.
    const promoted = await bootstrapAdmin(session);
    if (promoted?.is_admin) return { ...session, profile: promoted };

    // Signed in, but this account has no dashboard access. Previously this
    // bounced silently to the homepage, which is indistinguishable from the
    // site being broken — and the person most likely to hit it is the owner,
    // who has simply not been granted access yet. Someone already holding a
    // valid account learns nothing they could not learn by trying.
    redirect("/account?admin=denied");
  }
  return session;
}

export async function isAdminRequest(): Promise<boolean> {
  const session = await getSession();
  return Boolean(session?.profile?.is_admin);
}
