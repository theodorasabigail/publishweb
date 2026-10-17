import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { Field, PageHeader, Panel } from "@/components/admin/ui";
import { MenuArrows } from "@/components/admin/menu-arrows";
import { createPage } from "@/app/admin/_actions/blocks";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUILT_IN_PAGES, type PageRecord } from "@/lib/blocks";

export const dynamic = "force-dynamic";

/**
 * Every page of the site, in one list.
 *
 * The pages in the top menu come first, in menu order, with arrows to change
 * it; the rest follow. Tapping a page opens its sections. The simplest way to
 * edit is still on the site itself ("Edit this page"); this is the map.
 */
export default async function AdminPagesPage() {
  const supabase = createAdminClient();
  const [{ data: pageRows }, { data: blockRows }] = await Promise.all([
    supabase.from("pages").select("*").order("nav_order"),
    supabase.from("page_blocks").select("page"),
  ]);

  const records = (pageRows ?? []) as PageRecord[];
  const known = new Set(records.map((page) => page.slug));
  // Built-in pages always exist, even before the database has a row for them.
  const all = [
    ...records,
    ...BUILT_IN_PAGES.filter((page) => !known.has(page.slug)).map(
      (page) =>
        ({ ...page, show_in_nav: false, is_built_in: true, is_published: true, href: page.href }) as unknown as PageRecord,
    ),
  ];
  const sectionCount = (slug: string) =>
    ((blockRows ?? []) as { page: string }[]).filter((block) => block.page === slug).length;
  const inMenu = all.filter((page) => page.show_in_nav);
  const notInMenu = all.filter((page) => !page.show_in_nav);

  const row = (page: PageRecord, arrows?: { first: boolean; last: boolean }) => {
    const href = page.href ?? (page.is_built_in ? "/" : `/p/${page.slug}`);
    const count = sectionCount(page.slug);
    return (
      <div key={page.slug} className="flex items-center gap-3 py-2.5">
        {arrows ? <MenuArrows slug={page.slug} {...arrows} /> : <span className="w-[22px]" />}
        <Link href={`/admin/pages/${page.slug}`} className="group flex min-w-0 flex-1 items-center gap-3">
          <span className="min-w-0 flex-1">
            <span className="block font-medium group-hover:underline">{page.title}</span>
            <span className="block text-xs text-sea-800">
              {href} · {count ? `${count} section${count === 1 ? "" : "s"}` : "no sections added"}
            </span>
          </span>
          {!page.is_built_in && !page.is_published && (
            <span className="badge bg-sea-100 text-sea-800">Draft</span>
          )}
          <ChevronRight className="h-4 w-4 shrink-0 text-sea-800" />
        </Link>
      </div>
    );
  };

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Pages"
        description="Tap a page to change what is on it. Easier still: open the page on your site while signed in and press Edit this page."
      />

      <Panel title="In the top menu" description="In the order they appear. Use the arrows to move them." className="mb-6">
        <div className="divide-y divide-sea-200">
          {inMenu.length ? (
            inMenu.map((page, index) => row(page, { first: index === 0, last: index === inMenu.length - 1 }))
          ) : (
            <p className="py-2 text-sm text-sea-800">No pages in the menu.</p>
          )}
        </div>
      </Panel>

      {notInMenu.length > 0 && (
        <Panel
          title="Not in the menu"
          description="Still on the site at their address. Switch “Show in the top menu” on in a page's settings (the gear) to add one."
          className="mb-6"
        >
          <div className="divide-y divide-sea-200">{notInMenu.map((page) => row(page))}</div>
        </Panel>
      )}

      <Panel title="Add a page" description="A lookbook, wholesale, about the farm — it lives at /p/its-name.">
        <form action={createPage} className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <Field label="Name">
              <input name="title" className="input" placeholder="Wholesale" required />
            </Field>
          </div>
          <button type="submit" className="btn-primary py-2 text-xs">
            <Plus className="h-4 w-4" /> Add page
          </button>
        </form>
      </Panel>
    </div>
  );
}
