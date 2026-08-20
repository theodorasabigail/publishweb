/**
 * Pre-launch mode.
 *
 * Driven by an environment variable rather than a database setting, on
 * purpose: the check runs in the proxy on every request, and a database read
 * there would put back the per-request query cost that the storefront was
 * deliberately freed from. It also means the shop stays hidden even if
 * Supabase is unreachable, which is the safe direction for a switch whose job
 * is to keep something private.
 */

/** Paths that must keep working while the shop is hidden. */
const ALWAYS_LIVE = [
  "/coming-soon",
  "/admin", // run the shop before it opens
  "/login", // and be able to get in to do so
  "/signup",
  "/auth", // OAuth callback and sign-out
  "/api", // webhooks, checkout, quotes
  "/_next",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
];

export const COMING_SOON_COOKIE = "publish-preview";

export function isComingSoon(): boolean {
  return (process.env.COMING_SOON ?? "").toLowerCase() === "true";
}

export function isAlwaysLive(pathname: string): boolean {
  return ALWAYS_LIVE.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * The preview escape hatch, so the real site can be shown to people before it
 * opens: visit any page with ?preview=<COMING_SOON_PREVIEW_SECRET> once and a
 * cookie keeps it visible from then on.
 *
 * Not a security boundary — it only decides which page renders. Everything
 * genuinely private is still behind the admin and account gates.
 */
export function previewSecret(): string | null {
  const secret = process.env.COMING_SOON_PREVIEW_SECRET;
  return secret && secret.length > 0 ? secret : null;
}

/**
 * The wording the pre-launch page ships with.
 *
 * Every corresponding column is nullable and falls back to here, so an
 * operator who never opens the panel sees the page they already have, and
 * clearing a field restores this rather than leaving a blank page. It lives
 * beside the rest of the coming-soon logic so the copy and the switch that
 * shows it are never edited in two places.
 */
export const COMING_SOON_DEFAULTS = {
  eyebrow: "PT Aroma Pulau Arunika",
  title: "Publish Coffee Roasters",
  body:
    "A small roastery in Indonesia. Rotating single origins, blends we actually drink, and a custom roasting service for your own green beans.",
  note: "Opening soon.",
  contactLine: "Roasting for a caf\u00e9, or want coffee before we open? Talk to us.",
};
