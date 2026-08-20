import Link from "next/link";
import { ExternalLink, Plus } from "lucide-react";
import { EmptyRow, Field, PageHeader, Panel } from "@/components/admin/ui";
import { createPage } from "@/app/admin/_actions/blocks";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUILT_IN_PAGES, type PageRecord } from "@/lib/blocks";

export const dynamic = "force-dynamic";

export default async function AdminPagesPage() {
  const supabase = createAdminClient();

  const [{ data: pageRows }, { data: blockRows }] = await Promise.all([
    supabase.from("pages").select("*").order("title"),
    supabase.from("page_blocks").select("page, is_active"),
  ]);

  const pages = (pageRows ?? []) as PageRecord[];
  const blocks = (blockRows ?? []) as { page: string; is_active: boolean }[];

  const countFor = (slug: string) => blocks.filter((b) => b.page === slug).length;
  const liveFor = (slug: string) =>
    blocks.filter((b) => b.page === slug && b.is_active).length;

  return (
    <div>
      <PageHeader
        title="Pages"
        description="Build a page out of blocks — a picture and some words, a full-width video, a row of coffees. Add them, reorder them, turn them off."
      />

      <Panel title="Your main pages" className="mb-6">
        <div className="divide-y divide-sea-200">
          {BUILT_IN_PAGES.map((page) => (
            <Link
              key={page.slug}
              href={`/admin/pages/${page.slug}`}
              className="flex items-center gap-4 py-3 hover:bg-sea-50"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">{page.title}</p>
                <p className="text-sm text-sea-800">
                  {countFor(page.slug)
                    ? `${liveFor(page.slug)} of ${countFor(page.slug)} blocks showing`
                    : "No blocks yet"}
                </p>
              </div>
              <span className="text-sm text-sea-800">{page.href}</span>
            </Link>
          ))}
        </div>
      </Panel>

      <Panel
        title="Your own pages"
        description="Anything else — a lookbook, wholesale, an about-the-farm page. They live at /p/your-address."
        className="mb-6"
      >
        {pages.length ? (
          <div className="divide-y divide-sea-200">
            {pages.map((page) => (
              <div key={page.id} className="flex items-center gap-4 py-3">
                <Link href={`/admin/pages/${page.slug}`} className="min-w-0 flex-1">
                  <p className="font-medium hover:underline">{page.title}</p>
                  <p className="text-sm text-sea-800">
                    /p/{page.slug} ·{" "}
                    {countFor(page.slug)
                      ? `${liveFor(page.slug)} of ${countFor(page.slug)} blocks showing`
                      : "no blocks yet"}
                  </p>
                </Link>
                <span
                  className={`badge ${
                    page.is_published
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-sea-100 text-sea-800"
                  }`}
                >
                  {page.is_published ? "Live" : "Draft"}
                </span>
                {page.is_published && (
                  <a
                    href={`/p/${page.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sea-800 hover:text-ink"
                    aria-label="View page"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyRow>No pages of your own yet.</EmptyRow>
        )}
      </Panel>

      <Panel title="Add a page">
        <form action={createPage} className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <Field label="Name" hint="The address is made from this. You can change it after.">
              <input name="title" className="input" placeholder="Lookbook" />
            </Field>
          </div>
          <button type="submit" className="btn-primary py-2 text-xs">
            <Plus className="h-4 w-4" /> Create
          </button>
        </form>
      </Panel>
    </div>
  );
}
