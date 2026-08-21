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
  BUILT_IN_COPY,
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
      supabase.from("pages").select("*").eq("slug", slug).maybeSingle(),
      supabase.from("categories").select("*").order("sort_order"),
    ]);

  const record = pageRow as PageRecord | null;
  if (!builtIn && !record) notFound();

  const blocks = (blockRows ?? []) as PageBlock[];
  const categories = (categoryRows ?? []) as Category[];
  const title = record?.title ?? builtIn?.title ?? slug;
  const href = record?.href ?? builtIn?.href ?? `/p/${slug}`;
  const shipped = BUILT_IN_COPY[slug];
  const replacing = record?.blocks_mode === "replace";

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
          replacing
            ? "The blocks below are this whole page."
            : builtIn
              ? "Blocks here appear underneath the page as it already is — change that below."
              : "This page is made entirely of the blocks below."
        }
        action={
          <a href={href} target="_blank" rel="noreferrer" className="btn-secondary">
            <ExternalLink className="h-4 w-4" /> View
          </a>
        }
      />

      {record ? (
        <Panel title="This page" className="mb-6">
          <form action={updatePage} className="space-y-5">
            <input type="hidden" name="slug" value={record.slug} />
            <input
              type="hidden"
              name="is_built_in"
              value={record.is_built_in ? "true" : "false"}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Menu name" hint="What this page is called in the top menu.">
                <input name="title" className="input" defaultValue={record.title} />
              </Field>
              <Field label="Address">
                <input className="input" value={href} disabled />
              </Field>
            </div>

            {/* Wording. Only offered for pages that actually ship with any --
                the homepage and about page are built from their own settings
                and blocks, so an override here would have nothing to override. */}
            {shipped && (
              <div className="space-y-4 rounded-lg bg-sea-50 p-4">
                <p className="text-sm text-sea-800">
                  Rewrite what this page says. Leave a box empty to keep the
                  wording it came with.
                </p>
                <Field label="Heading">
                  <input
                    name="heading"
                    className="input"
                    defaultValue={record.heading ?? ""}
                    placeholder={shipped.heading}
                  />
                </Field>
                <Field label="Paragraph underneath" hint="Line breaks are kept.">
                  <textarea
                    name="intro"
                    className="input min-h-24"
                    defaultValue={record.intro ?? ""}
                    placeholder={shipped.intro}
                  />
                </Field>
              </div>
            )}

            <Field
              label="What the blocks do"
              hint={
                replacing
                  ? "The blocks below are the whole page. Nothing built in is shown."
                  : "The blocks below appear underneath the page as it already is."
              }
            >
              <select
                name="blocks_mode"
                className="input"
                defaultValue={record.blocks_mode}
              >
                <option value="append">Add to the page</option>
                <option value="replace">Replace the page entirely</option>
              </select>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Search engine title">
                <input
                  name="seo_title"
                  className="input"
                  defaultValue={record.seo_title ?? ""}
                />
              </Field>
              <Field label="Search engine description">
                <input
                  name="seo_description"
                  className="input"
                  defaultValue={record.seo_description ?? ""}
                />
              </Field>
            </div>

            <div className="flex flex-wrap items-center gap-6">
              {!record.is_built_in && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="is_published"
                    defaultChecked={record.is_published}
                    className="h-4 w-4 rounded border-sea-300"
                  />
                  Published — visitors can see it
                </label>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="show_in_nav"
                  defaultChecked={record.show_in_nav}
                  className="h-4 w-4 rounded border-sea-300"
                />
                Show in the top menu
              </label>
              <label className="flex items-center gap-2 text-sm">
                Menu position
                <input
                  type="number"
                  name="nav_order"
                  defaultValue={record.nav_order}
                  className="input w-20"
                />
              </label>
            </div>

            <button type="submit" className="btn-primary py-2 text-xs">
              Save page
            </button>
          </form>
        </Panel>
      ) : (
        <Panel title="This page" className="mb-6">
          <p className="text-sm text-sea-800">
            The wording and menu controls for this page live in your database,
            and it has not been added yet. Run{" "}
            <code className="rounded bg-sea-100 px-1.5 py-0.5 text-xs">
              supabase/setup.sql
            </code>{" "}
            in Supabase and reload. Blocks below work either way.
          </p>
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

      {record && !record.is_built_in && (
        <form action={deletePage} className="mt-8">
          <input type="hidden" name="id" value={record.id} />
          <input type="hidden" name="slug" value={record.slug} />
          <button type="submit" className="text-xs text-red-700 hover:underline">
            Delete this page and everything on it
          </button>
        </form>
      )}
    </div>
  );
}
