import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";
import { PageHeader } from "@/components/admin/ui";
import { AdminPageEditor } from "@/components/admin/admin-page-editor";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { deletePage } from "@/app/admin/_actions/blocks";
import { pageEditorData } from "@/app/admin/_actions/page-editor";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * One page, as its list of sections.
 *
 * The same editor as "Edit this page" on the site. The easier place to use it
 * is there, beside the page itself; this is the same thing for when you are
 * already in the admin.
 */
export default async function AdminPageEditorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await pageEditorData(slug);
  if (!data) notFound();

  const { data: record } = data.isBuiltIn
    ? { data: null }
    : await createAdminClient().from("pages").select("id").eq("slug", slug).maybeSingle();

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/pages"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-sea-800 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> All pages
      </Link>

      <PageHeader
        title={data.title}
        description="The page’s sections, top to bottom. Tap one to edit it — changes save as you go."
        action={
          <a href={data.href} className="btn-secondary">
            <Eye className="h-4 w-4" /> Edit on the page itself
          </a>
        }
      />

      <AdminPageEditor initial={data} />

      {record && (
        <form action={deletePage} className="mt-10 border-t border-sea-200 pt-6">
          <input type="hidden" name="id" value={(record as { id: string }).id} />
          <input type="hidden" name="slug" value={slug} />
          <ConfirmSubmit
            question="Delete this page and every section on it, for good?"
            confirmLabel="Yes, delete the page"
            className="text-xs text-red-700 hover:underline"
          >
            Delete this page…
          </ConfirmSubmit>
        </form>
      )}
    </div>
  );
}
