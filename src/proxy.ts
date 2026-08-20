import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  COMING_SOON_COOKIE,
  isAlwaysLive,
  isComingSoon,
  previewSecret,
} from "@/lib/coming-soon";

/**
 * Refreshes the Supabase auth session on every request so server components
 * always see a valid token. Without this, a session silently expires mid-visit
 * and the customer gets bounced out of their dashboard.
 *
 * This is Next's `proxy` convention (called `middleware` before Next 16). It
 * only refreshes tokens -- it is deliberately not where access is decided.
 * Admin and account authorisation lives in `requireAdmin` / `requireUser`,
 * which run server-side per page, so a proxy bypass cannot expose anything.
 */
export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // ---------------------------------------------------------------------
  // Pre-launch: hide the shop, keep the admin and everything machine-facing
  // working. Checked before anything else so it costs one string comparison.
  // ---------------------------------------------------------------------
  if (isComingSoon() && !isAlwaysLive(pathname)) {
    const secret = previewSecret();
    const offered = searchParams.get("preview");

    // Arriving with the right link opens the real site and remembers it.
    if (secret && offered === secret) {
      const cleaned = request.nextUrl.clone();
      cleaned.searchParams.delete("preview");
      const pass = NextResponse.redirect(cleaned);
      pass.cookies.set(COMING_SOON_COOKIE, secret, {
        httpOnly: true,
        sameSite: "lax",
        secure: true,
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      });
      return pass;
    }

    const holder = request.cookies.get(COMING_SOON_COOKIE)?.value;
    if (!secret || holder !== secret) {
      // Rewrite rather than redirect, so the visitor keeps the URL they typed
      // and the real routes are simply not reachable yet.
      return NextResponse.rewrite(new URL("/coming-soon", request.url));
    }
  }

  let response = NextResponse.next({ request });

  // ---------------------------------------------------------------------
  // Only refresh the session where a session is actually used.
  //
  // Refreshing means asking Supabase Auth to validate the token, which is a
  // network round-trip. Anonymous visitors cost nothing -- with no cookie the
  // client answers locally -- but a signed-in customer browsing the shop was
  // paying one round-trip per page for a session no storefront page reads.
  // Measured: /shop, /blog and the homepage make zero database calls, then
  // this added an auth call on top of every one of them.
  //
  // Skipping is safe because refresh tokens outlive access tokens by weeks.
  // A customer can read the shop all afternoon on an expired access token and
  // it is renewed the moment they open their account or check out.
  // ---------------------------------------------------------------------
  if (!needsSession(pathname)) return response;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  await supabase.auth.getUser();
  return response;
}

/**
 * Paths whose rendering depends on who is signed in.
 *
 * Deliberately a prefix list rather than "everything except the shop": a new
 * page that forgets to appear here still works, it just renders for a signed
 * -out visitor until they touch one of these. The failure mode is a stale
 * session, never a wrong one -- every page still checks authorisation itself
 * in requireAdmin / requireUser.
 */
const SESSION_PATHS = [
  "/admin",
  "/account",
  "/checkout",
  "/order",
  "/login",
  "/signup",
  "/auth",
  "/api",
];

function needsSession(pathname: string): boolean {
  return SESSION_PATHS.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export const config = {
  matcher: [
    /*
     * Everything except static assets, image optimisation, and the webhook
     * routes -- webhooks carry no session and must not pay for a token refresh.
     */
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
