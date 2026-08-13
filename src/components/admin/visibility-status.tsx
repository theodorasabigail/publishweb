import { Eye, EyeOff } from "lucide-react";
import { isComingSoon, previewSecret } from "@/lib/coming-soon";
import { siteUrl } from "@/lib/env";

/**
 * "Can the public see my shop right now?"
 *
 * The pre-launch banner only appears when the shop is hidden, which leaves the
 * other state unanswerable from inside the admin. This says either way.
 */
export function VisibilityStatus() {
  const hidden = isComingSoon();
  const secret = previewSecret();

  if (hidden) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
        <p className="flex items-center gap-2 text-sm font-medium text-amber-900">
          <EyeOff className="h-4 w-4" /> Hidden — visitors see the coming-soon page
        </p>
        <p className="mt-2 text-sm text-amber-900">
          To open the shop, change <code className="rounded bg-white/70 px-1.5 py-0.5 text-xs">COMING_SOON</code>{" "}
          to <code className="rounded bg-white/70 px-1.5 py-0.5 text-xs">false</code> in Vercel and redeploy.
        </p>
        {secret && (
          <p className="mt-2 text-xs text-amber-800">
            Preview link: {siteUrl()}/?preview={secret}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-emerald-900">
        <Eye className="h-4 w-4" /> Live — anyone can see and buy from your shop
      </p>
      <p className="mt-2 text-sm text-emerald-900">
        To hide it behind a coming-soon page, add a setting in Vercel called{" "}
        <code className="rounded bg-white/70 px-1.5 py-0.5 text-xs">COMING_SOON</code>{" "}
        with the value <code className="rounded bg-white/70 px-1.5 py-0.5 text-xs">true</code>, then redeploy.
        Your admin keeps working either way.
      </p>
    </div>
  );
}
