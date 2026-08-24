import { FlavourPicker } from "@/components/admin/flavour-picker";
import { ImageUploader } from "@/components/admin/image-uploader";
import { TitleAndSlug } from "@/components/admin/slug-input";
import { Field, Panel } from "@/components/admin/ui";
import { createProduct, updateProduct } from "@/app/admin/_actions/products";
import { VariantEditor } from "@/components/admin/variant-editor";
import type { Category, ProductWithVariants } from "@/lib/types";

export function ProductForm({
  product,
  categories,
  extraCategoryIds = [],
}: {
  product?: ProductWithVariants;
  categories: Category[];
  /** Category ids the product also appears in, beyond its primary one. */
  extraCategoryIds?: string[];
}) {
  const isEdit = Boolean(product);

  return (
    <form action={isEdit ? updateProduct : createProduct} className="space-y-6">
      {isEdit && <input type="hidden" name="id" value={product!.id} />}

      <Panel title="The basics">
        <div className="space-y-5">
          <TitleAndSlug
            titleName="name"
            slugName="slug"
            titleLabel="Product name"
            defaultTitle={product?.name ?? ""}
            defaultSlug={product?.slug ?? ""}
            prefix="/shop/"
          />

          <Field label="Tasting notes" hint="Shown under the name. Keep it short.">
            <input
              name="tasting_notes"
              className="input"
              defaultValue={product?.tasting_notes ?? ""}
              placeholder="Dark chocolate, cedar, brown sugar"
            />
          </Field>

          <Field label="Description">
            <textarea
              name="description"
              className="input min-h-32"
              defaultValue={product?.description ?? ""}
              placeholder="A paragraph or two about this coffee."
            />
          </Field>

          <Field
            label="Primary category"
            hint="The one shown on the coffee's card and used in its URL."
          >
            <select
              name="category_id"
              className="input"
              defaultValue={product?.category_id ?? ""}
            >
              <option value="">Uncategorised</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Also appears in"
            hint="Ticked categories list this coffee too. The primary above is not repeated."
          >
            <div className="flex flex-wrap gap-3">
              {categories.length === 0 && (
                <p className="text-sm text-sea-800">
                  No other categories yet. Add one under Categories.
                </p>
              )}
              {categories.map((category) => {
                const chosen = extraCategoryIds.includes(category.id);
                return (
                  <label
                    key={category.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="extra_category_ids"
                      value={category.id}
                      defaultChecked={chosen}
                      className="rounded border-sea-300"
                    />
                    {category.name}
                  </label>
                );
              })}
            </div>
          </Field>
        </div>
      </Panel>

      <Panel
        title="Sizes, prices and stock"
        description="Any sizes you like. Set a price above zero and tick “On sale” to put one in the shop."
      >
        <VariantEditor variants={product?.product_variants} />
      </Panel>

      <Panel title="Coffee details" description="Shown in the spec table on the product page.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Origin">
            <input name="origin" className="input" defaultValue={product?.origin ?? ""} placeholder="Aceh Tengah, Sumatra" />
          </Field>
          <Field label="Process">
            <input name="process" className="input" defaultValue={product?.process ?? ""} placeholder="Wet Hulled" />
          </Field>
          <Field label="Varietal">
            <input name="varietal" className="input" defaultValue={product?.varietal ?? ""} placeholder="Ateng, Timtim" />
          </Field>
          <Field label="Altitude (masl)">
            <input name="masl" className="input" defaultValue={product?.masl ?? ""} placeholder="1400–1600" />
          </Field>
          <Field label="Roast level">
            <input name="roast_level" className="input" defaultValue={product?.roast_level ?? ""} placeholder="Medium" />
          </Field>
        </div>
      </Panel>

      <Panel title="Look" description="How this coffee appears on the shop.">
        <div className="space-y-5">
          <ImageUploader
            name="image_url"
            label="Product photo"
            defaultValue={product?.image_url}
            folder="products"
            hint="Square images work best. Without one, the card shows the name on the flavour colour."
          />

          <Field label="Image description" hint="Describes the photo for screen readers and search engines.">
            <input
              name="image_alt"
              className="input"
              defaultValue={product?.image_alt ?? ""}
              placeholder="A bag of Gayo Arunika on a wooden table"
            />
          </Field>

          <FlavourPicker defaultValue={product?.flavour_level} />

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={product ? product.is_active : true}
                className="h-4 w-4 rounded border-sea-300"
              />
              Show on the shop
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="is_featured"
                defaultChecked={product?.is_featured ?? false}
                className="h-4 w-4 rounded border-sea-300"
              />
              Feature on the homepage
            </label>
          </div>

          <input type="hidden" name="sort_order" value={product?.sort_order ?? 0} />
        </div>
      </Panel>

      <Panel
        title="Search engines"
        description="Optional. Left blank, we use the product name and tasting notes."
      >
        <div className="space-y-4">
          <Field label="Page title">
            <input name="seo_title" className="input" defaultValue={product?.seo_title ?? ""} />
          </Field>
          <Field label="Description" hint="Around 155 characters shows in full on Google.">
            <textarea
              name="seo_description"
              className="input min-h-20"
              defaultValue={product?.seo_description ?? ""}
            />
          </Field>
          <ImageUploader
            name="og_image_url"
            label="Social sharing image"
            defaultValue={product?.og_image_url}
            folder="social"
            hint="Used when the page is shared on WhatsApp, Instagram or X."
          />
        </div>
      </Panel>

      <div className="flex gap-3">
        <button type="submit" className="btn-primary">
          {isEdit ? "Save changes" : "Create product"}
        </button>
      </div>
    </form>
  );
}
