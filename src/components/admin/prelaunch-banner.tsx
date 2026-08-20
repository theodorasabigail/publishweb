import Link from "next/link";
import { EyeOff } from "lucide-react";
import { isComingSoon, previewSecret } from "@/lib/coming-soon";
import { siteUrl } from "@/lib/env";

/**
 * Shown across the admin while the shop is hidden.
 *
 * Without it there is no way to tell from in here whether the public can see
 * the shop, and the preview link is the kind of thing nobody remembers — so it
 * is printed rather than described.
 */
/**
 * When this deployment was built.
 *
 * The single most useful fact for "I added the setting and nothing happened",
 * because it distinguishes the two cases: a build older than the change means
 * a redeploy is needed, a newer one means the setting is scoped to the wrong
 * environment. Frozen at build time by design — that is exactly what makes it
 * evidence about which build is serving.
 */
function buildStamp(): string {
  const iso = process.env.NEXT_PUBLIC_BUILD_TIME;
  if (!iso) return "at an unknown time";
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return "at an unknown time";
  return `on ${when.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  })} UTC`;
}

export function PrelaunchBanner() {
  if (!isComingSoon()) return null;

  const secret = previewSecret();
  const previewUrl = secret ? `${siteUrl()}/?preview=${encodeURIComponent(secret)}` : null;

  return (
    <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-amber-900">
        <EyeOff className="h-4 w-4 shrink-0" />
        Your shop is hidden. Visitors see the coming-soon page.
      </p>

      <p className="mt-2 text-sm text-amber-900">
        Everything in here works normally — add coffees, set prices, take test
        orders. Nobody can see the shop itself until you open it.
      </p>

      {previewUrl ? (
        <>
          <p className="mt-3 text-sm text-amber-900">
            To see the real site yourself, or to show someone:
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Link
              href={previewUrl}
              target="_blank"
              className="btn bg-amber-900 py-2 text-xs text-amber-50 hover:bg-amber-950"
            >
              Open the real site
            </Link>
            <code className="break-all rounded bg-white/70 px-2 py-1 text-xs text-amber-900">
              {previewUrl}
            </code>
          </div>
          <p className="mt-2 text-xs text-amber-800">
            That link works for anyone you send it to, and keeps working on
            their device for 30 days.
          </p>
        </>
      ) : (
        <div className="mt-3 text-sm text-amber-900">
          <p>
            To preview the real site, this deployment needs a setting called{" "}
            <code className="rounded bg-white/70 px-1.5 py-0.5 text-xs">
              COMING_SOON_PREVIEW_SECRET
            </code>{" "}
            with any hard-to-guess phrase as its value.
          </p>

          {/* Saying "it is not set" would be wrong and would send them looking
              in the wrong place: the setting can exist in Vercel and still not
              reach the running server. What is true is that this deployment
              cannot see it, and the two reasons for that are worth naming
              rather than leaving to be guessed. */}
          <p className="mt-2">
            <strong>This deployment cannot see it.</strong> If you have already
            added it in Vercel, it is almost always one of these two:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>It needs a redeploy.</strong> Adding a setting does not
              rebuild the site by itself — the running deployment was built
              before your change and still has the old settings. Vercel →
              Deployments → ⋯ → Redeploy.
            </li>
            <li>
              <strong>It may be ticked for the wrong environment.</strong> Vercel
              asks whether a setting applies to Production, Preview and
              Development. This page is Production, so Production must be
              ticked.
            </li>
          </ul>
          <p className="mt-2 text-xs text-amber-800">
            This deployment was built {buildStamp()}. If that is before you added
            the setting, a redeploy is the answer.
          </p>
        </div>
      )}
    </div>
  );
}
