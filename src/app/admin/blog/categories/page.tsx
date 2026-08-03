import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { ColorPicker } from "@/components/admin/color-picker";
import { TitleAndSlug } from "@/components/admin/slug-input";
import { EmptyRow, Field, PageHeader, Panel } from "@/components/admin/ui";
import { deleteBlogCategory, saveBlogCategory } from "@/app/admin/_actions/categories";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BlogCategory } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminBlogCategoriesPage() {
  const supabase = createAdminClient();
  const { data } = await supabase.from("blog_categories").select("*").order("sort_order");
  const rows = (data ?? []) as BlogCategory[];

  return (
    <div>
      <Link
        href="/admin/blog"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-bark-600 hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Journal
      </Link>

      <PageHeader
        title="Journal categories"
        description="The sections of the archive. Each gets its own browsable page."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          {rows.length ? (
            rows.map((category) => (
              <Panel key={category.id}>
                <form action={saveBlogCategory} className="space-y-4">
                  <input type="hidden" name="id" value={category.id} />
                  <TitleAndSlug
                    titleName="name"
                    slugName="slug"
                    titleLabel="Name"
                    defaultTitle={category.name}
                    defaultSlug={category.slug}
                    prefix="/blog/category/"
                  />
                  <Field label="Description">
                    <textarea
                      name="description"
                      className="input min-h-16"
                      defaultValue={category.description ?? ""}
                    />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ColorPicker
                      name="accent_color"
                      label="Accent colour"
                      defaultValue={category.accent_color}
                    />
                    <Field label="Order">
                      <input
                        type="number"
                        name="sort_order"
                        className="input w-24"
                        defaultValue={category.sort_order}
                      />
                    </Field>
                  </div>
                  <button type="submit" className="btn-primary py-2 text-xs">
                    Save
                  </button>
                </form>

                <form action={deleteBlogCategory} className="mt-3 border-t border-bark-200 pt-3">
                  <input type="hidden" name="id" value={category.id} />
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 text-xs text-bark-500 hover:text-red-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </form>
              </Panel>
            ))
          ) : (
            <EmptyRow>No categories yet.</EmptyRow>
          )}
        </div>

        <Panel title="Add a category" className="h-fit">
          <form action={saveBlogCategory} className="space-y-4">
            <TitleAndSlug
              titleName="name"
              slugName="slug"
              titleLabel="Name"
              prefix="/blog/category/"
            />
            <Field label="Description">
              <textarea name="description" className="input min-h-16" />
            </Field>
            <ColorPicker name="accent_color" label="Accent colour" defaultValue="#714c39" />
            <Field label="Order">
              <input
                type="number"
                name="sort_order"
                className="input w-24"
                defaultValue={rows.length + 1}
              />
            </Field>
            <button type="submit" className="btn-primary w-full">
              Add category
            </button>
          </form>
        </Panel>
      </div>
    </div>
  );
}
