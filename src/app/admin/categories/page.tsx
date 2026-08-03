import { Trash2 } from "lucide-react";
import { ImageUploader } from "@/components/admin/image-uploader";
import { TitleAndSlug } from "@/components/admin/slug-input";
import { EmptyRow, Field, PageHeader, Panel } from "@/components/admin/ui";
import { deleteCategory, saveCategory } from "@/app/admin/_actions/categories";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Category } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const supabase = createAdminClient();
  const [{ data: categories }, { data: counts }] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("products").select("category_id"),
  ]);

  const rows = (categories ?? []) as Category[];
  const productCounts = new Map<string, number>();
  for (const row of (counts ?? []) as { category_id: string | null }[]) {
    if (row.category_id) {
      productCounts.set(row.category_id, (productCounts.get(row.category_id) ?? 0) + 1);
    }
  }

  return (
    <div>
      <PageHeader
        title="Categories"
        description="How the shop is grouped. A product belongs to one category."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="space-y-4">
          {rows.length ? (
            rows.map((category) => (
              <Panel key={category.id}>
                <form action={saveCategory} className="space-y-4">
                  <input type="hidden" name="id" value={category.id} />

                  <TitleAndSlug
                    titleName="name"
                    slugName="slug"
                    titleLabel="Name"
                    defaultTitle={category.name}
                    defaultSlug={category.slug}
                    prefix="/shop/category/"
                  />

                  <Field label="Description">
                    <textarea
                      name="description"
                      className="input min-h-20"
                      defaultValue={category.description ?? ""}
                    />
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Order" hint="Lower numbers come first.">
                      <input
                        type="number"
                        name="sort_order"
                        className="input w-24"
                        defaultValue={category.sort_order}
                      />
                    </Field>

                    <div className="flex items-end pb-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          name="show_on_homepage"
                          defaultChecked={category.show_on_homepage}
                          className="h-4 w-4 rounded border-bark-300"
                        />
                        Available for the homepage
                      </label>
                    </div>
                  </div>

                  <ImageUploader
                    name="image_url"
                    label="Category image"
                    defaultValue={category.image_url}
                    folder="categories"
                  />

                  <details>
                    <summary className="cursor-pointer text-sm text-bark-600">
                      Search engine settings
                    </summary>
                    <div className="mt-3 space-y-3">
                      <Field label="Page title">
                        <input
                          name="seo_title"
                          className="input"
                          defaultValue={category.seo_title ?? ""}
                        />
                      </Field>
                      <Field label="Description">
                        <textarea
                          name="seo_description"
                          className="input min-h-16"
                          defaultValue={category.seo_description ?? ""}
                        />
                      </Field>
                    </div>
                  </details>

                  <div className="flex items-center justify-between gap-3 border-t border-bark-200 pt-4">
                    <span className="text-xs text-bark-500">
                      {productCounts.get(category.id) ?? 0} products
                    </span>
                    <div className="flex gap-2">
                      <button type="submit" className="btn-primary py-2 text-xs">
                        Save
                      </button>
                    </div>
                  </div>
                </form>

                <form action={deleteCategory} className="mt-3 border-t border-bark-200 pt-3">
                  <input type="hidden" name="id" value={category.id} />
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 text-xs text-bark-500 hover:text-red-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete category
                  </button>
                  <p className="mt-1 text-xs text-bark-400">
                    Products in it stay on the shop, just uncategorised.
                  </p>
                </form>
              </Panel>
            ))
          ) : (
            <EmptyRow>No categories yet. Add one on the right.</EmptyRow>
          )}
        </div>

        <Panel title="Add a category" className="h-fit">
          <form action={saveCategory} className="space-y-4">
            <TitleAndSlug
              titleName="name"
              slugName="slug"
              titleLabel="Name"
              prefix="/shop/category/"
            />
            <Field label="Description">
              <textarea name="description" className="input min-h-20" />
            </Field>
            <Field label="Order">
              <input
                type="number"
                name="sort_order"
                className="input w-24"
                defaultValue={rows.length + 1}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="show_on_homepage"
                defaultChecked
                className="h-4 w-4 rounded border-bark-300"
              />
              Available for the homepage
            </label>
            <button type="submit" className="btn-primary w-full">
              Add category
            </button>
          </form>
        </Panel>
      </div>
    </div>
  );
}
