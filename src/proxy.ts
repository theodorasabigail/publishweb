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

export const config = {
  matcher: [
    /*
     * Everything except static assets, image optimisation, and the webhook
     * routes -- webhooks carry no session and must not pay for a token refresh.
     */
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
