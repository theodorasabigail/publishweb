import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { EmptyRow, PageHeader, Panel } from "@/components/admin/ui";
import { deleteUnusedMedia } from "@/app/admin/_actions/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatBytes } from "@/lib/image-compression";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** The free Supabase plan's file storage allowance. */
const STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024;

export default async function AdminMediaPage() {
  const supabase = createAdminClient();

  const [{ data: usageRows }, { data: unusedRows }] = await Promise.all([
    supabase.rpc("media_storage_usage"),
    supabase.rpc("unused_media"),
  ]);

  const usage = ((usageRows ?? []) as { object_count: number; total_bytes: number }[])[0] ?? {
    object_count: 0,
    total_bytes: 0,
  };
  const unused = (unusedRows ?? []) as {
    name: string;
    size_bytes: number;
    uploaded_at: string;
  }[];

  const percent = Math.min(100, (usage.total_bytes / STORAGE_LIMIT_BYTES) * 100);
  const reclaimable = unused.reduce((sum, file) => sum + Number(file.size_bytes), 0);
  const tone = percent > 80 ? "red" : percent > 50 ? "amber" : "emerald";

  return (
    <div>
      <Link
        href="/admin/settings"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-bark-600 hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Site settings
      </Link>

      <PageHeader
        title="Images & storage"
        description="How much of your image allowance is used, and what can be cleared out."
      />

      <Panel title="Storage used">
        <div className="flex items-baseline justify-between gap-4">
          <p className="font-serif text-3xl">{formatBytes(usage.total_bytes)}</p>
          <p className="text-sm text-bark-600">
            of {formatBytes(STORAGE_LIMIT_BYTES)} · {usage.object_count} files
          </p>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-bark-100">
          <div
            className={`h-full rounded-full transition-all ${
              tone === "red"
                ? "bg-red-600"
                : tone === "amber"
                  ? "bg-amber-500"
                  : "bg-emerald-600"
            }`}
            style={{ width: `${Math.max(1, percent)}%` }}
          />
        </div>

        <p className="mt-3 text-sm text-bark-600">
          {percent < 50
            ? "Plenty of room. Images are shrunk automatically when you upload them, so this should grow slowly."
            : percent < 80
              ? "Worth keeping an eye on. Clearing unused files below is the easiest win."
              : "Getting full. Clear the unused files below, or upgrade the Supabase plan."}
        </p>
      </Panel>

      <Panel
        title={`Unused files (${unused.length})`}
        description="Images no product, category or post points at any more — usually photos you replaced."
        className="mt-6"
      >
        {unused.length ? (
          <>
            <p className="mb-4 text-sm text-bark-600">
              Deleting these frees{" "}
              <strong>{formatBytes(reclaimable)}</strong>. Anything uploaded in
              the last day is left alone, so work in progress is never touched.
            </p>

            <ul className="mb-5 max-h-72 divide-y divide-bark-200 overflow-y-auto rounded-lg border border-bark-200">
              {unused.map((file) => (
                <li
                  key={file.name}
                  className="flex items-center justify-between gap-4 px-3 py-2 text-sm"
                >
                  <span className="truncate font-mono text-xs text-bark-600">
                    {file.name}
                  </span>
                  <span className="shrink-0 text-xs text-bark-500">
                    {formatBytes(Number(file.size_bytes))} ·{" "}
                    {formatDate(file.uploaded_at)}
                  </span>
                </li>
              ))}
            </ul>

            <form action={deleteUnusedMedia}>
              <button type="submit" className="btn-danger py-2 text-xs">
                <Trash2 className="h-3.5 w-3.5" /> Delete all {unused.length} unused
                files
              </button>
            </form>
          </>
        ) : (
          <EmptyRow>Nothing to clear out — every stored image is in use.</EmptyRow>
        )}
      </Panel>

      <Panel title="How images are handled" className="mt-6">
        <ul className="space-y-2 text-sm text-bark-600">
          <li>
            Every image you upload is resized and re-compressed in your browser
            first. A photo straight off a phone typically goes from several
            megabytes to under 300 KB, with no visible difference at the size
            the site shows it.
          </li>
          <li>
            The website serves its own cached copies, so visitors almost never
            pull the file from Supabase directly. That is what keeps the
            monthly transfer allowance from running down.
          </li>
          <li>
            Replacing a photo does not overwrite the old one — it uploads a new
            file. That is why unused files build up, and why this page exists.
          </li>
        </ul>
      </Panel>
    </div>
  );
}
