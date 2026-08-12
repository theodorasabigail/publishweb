"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { User } from "lucide-react";

/**
 * The header's account link.
 *
 * This is a client component for one reason: reading the session on the server
 * meant reading cookies in the site layout, and a layout that reads cookies
 * opts every page beneath it out of static rendering. That made the entire
 * storefront re-query the database on every view — so that one word in the
 * header could differ.
 *
 * The check is only ever used to choose a label. It looks for a Supabase auth
 * cookie rather than calling the network, so it costs nothing, and getting it
 * wrong is harmless: /account redirects anonymous visitors to /login anyway.
 */

const AUTH_COOKIE = /(^|;\s*)sb-[^=;]*auth-token[^=;]*=/;

function hasAuthCookie(): boolean {
  return AUTH_COOKIE.test(document.cookie);
}

/** The cookie cannot change without a navigation, so there is nothing to
 *  subscribe to. Returning a no-op unsubscribe satisfies the contract. */
function subscribe(): () => void {
  return () => {};
}

/** The server has no cookie access here by design, and anonymous is the common
 *  case, so it renders the signed-out label and the client corrects it if
 *  needed. */
function serverSnapshot(): boolean {
  return false;
}

export function AccountLink() {
  const signedIn = useSyncExternalStore(subscribe, hasAuthCookie, serverSnapshot);

  return (
    <Link
      href={signedIn ? "/account" : "/login"}
      className="btn-ghost px-3"
      aria-label={signedIn ? "Your account" : "Sign in"}
    >
      <User className="h-4 w-4" />
      <span className="hidden text-sm sm:inline">{signedIn ? "Account" : "Sign in"}</span>
    </Link>
  );
}
