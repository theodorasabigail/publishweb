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
        <p className="mt-3 text-sm text-amber-900">
          To be able to preview the real site, add a setting in Vercel called{" "}
          <code className="rounded bg-white/70 px-1.5 py-0.5 text-xs">
            COMING_SOON_PREVIEW_SECRET
          </code>{" "}
          with any hard-to-guess phrase as its value, then redeploy. A preview
          link will appear here.
        </p>
      )}
    </div>
  );
}
