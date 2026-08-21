import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Plus } from "lucide-react";
import { BlockEditor } from "@/components/admin/block-editor";
import { BlockPreview } from "@/components/admin/block-preview";
import { EmptyRow, Field, PageHeader, Panel } from "@/components/admin/ui";
import { addBlock, deletePage, updatePage } from "@/app/admin/_actions/blocks";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  BLOCK_DEFINITIONS,
  BUILT_IN_PAGES,
  type PageBlock,
  type PageRecord,
} from "@/lib/blocks";
import type { Category } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminPageBlocksPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = createAdminClient();

  const builtIn = BUILT_IN_PAGES.find((page) => page.slug === slug);

  const [{ data: blockRows }, { data: pageRow }, { data: categoryRows }] =
    await Promise.all([
      supabase.from("page_blocks").select("*").eq("page", slug).order("sort_order"),
      builtIn
        ? Promise.resolve({ data: null })
        : supabase.from("pages").select("*").eq("slug", slug).maybeSingle(),
      supabase.from("categories").select("*").order("sort_order"),
    ]);

  const custom = pageRow as PageRecord | null;
  if (!builtIn && !custom) notFound();

  const blocks = (blockRows ?? []) as PageBlock[];
  const categories = (categoryRows ?? []) as Category[];
  const title = builtIn?.title ?? custom!.title;
  const href = builtIn?.href ?? `/p/${slug}`;

  return (
    <div>
      <Link
        href="/admin/pages"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-sea-800 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> All pages
      </Link>

      <PageHeader
        title={title}
        description={
          builtIn
            ? "Blocks here appear on the page underneath what is already there."
            : "This page is made entirely of the blocks below."
        }
        action={
          <a href={href} target="_blank" rel="noreferrer" className="btn-secondary">
            <ExternalLink className="h-4 w-4" /> View
          </a>
        }
      />

      {custom && (
        <Panel title="Page settings" className="mb-6">
          <form action={updatePage} className="space-y-5">
            <input type="hidden" name="id" value={custom.id} />
            <input type="hidden" name="slug" value={custom.slug} />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name">
                <input name="title" className="input" defaultValue={custom.title} />
              </Field>
              <Field label="Address" hint="Changing this breaks any link already shared.">
                <input className="input" value={`/p/${custom.slug}`} disabled />
              </Field>
              <Field label="Search engine title">
                <input name="seo_title" className="input" defaultValue={custom.seo_title ?? ""} />
              </Field>
              <Field label="Search engine description">
                <input
                  name="seo_description"
                  className="input"
                  defaultValue={custom.seo_description ?? ""}
                />
              </Field>
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="is_published"
                  defaultChecked={custom.is_published}
                  className="h-4 w-4 rounded border-sea-300"
                />
                Published — visitors can see it
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="show_in_nav"
                  defaultChecked={custom.show_in_nav}
                  className="h-4 w-4 rounded border-sea-300"
                />
                Show in the menu
              </label>
              <label className="flex items-center gap-2 text-sm">
                Menu position
                <input
                  type="number"
                  name="nav_order"
                  defaultValue={custom.nav_order}
                  className="input w-20"
                />
              </label>
            </div>

            <button type="submit" className="btn-primary py-2 text-xs">
              Save page
            </button>
          </form>
        </Panel>
      )}

      <div className="space-y-3">
        {blocks.length ? (
          blocks.map((block, index) => (
            <BlockEditor
              key={block.id}
              block={block}
              page={slug}
              categories={categories}
              isFirst={index === 0}
              isLast={index === blocks.length - 1}
            />
          ))
        ) : (
          <EmptyRow>
            Nothing here yet. Add a block below — they stack down the page in the
            order you put them.
          </EmptyRow>
        )}
      </div>

      <Panel title="Add a block" className="mt-6">
        {/* Each option is a one-button form, so choosing a block is one click
            rather than pick-then-confirm. New blocks arrive switched off. */}
        <div className="grid gap-3 sm:grid-cols-2">
          {BLOCK_DEFINITIONS.map((definition) => (
            <form key={definition.type} action={addBlock}>
              <input type="hidden" name="page" value={slug} />
              <input type="hidden" name="block_type" value={definition.type} />
              <button
                type="submit"
                className="flex w-full items-start gap-4 rounded-lg border border-sea-200 p-4 text-left transition-colors hover:border-sea-400 hover:bg-sea-50"
              >
                <BlockPreview type={definition.type} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Plus className="h-4 w-4 shrink-0 text-sea-800" />
                    {definition.label}
                  </span>
                  <span className="mt-1 block text-sm text-sea-800">
                    {definition.summary}
                  </span>
                </span>
              </button>
            </form>
          ))}
        </div>
      </Panel>

      {custom && (
        <form action={deletePage} className="mt-8">
          <input type="hidden" name="id" value={custom.id} />
          <input type="hidden" name="slug" value={custom.slug} />
          <button type="submit" className="text-xs text-red-700 hover:underline">
            Delete this page and everything on it
          </button>
        </form>
      )}
    </div>
  );
}
