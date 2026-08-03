import { ColorPicker } from "@/components/admin/color-picker";
import { ImageUploader } from "@/components/admin/image-uploader";
import { TitleAndSlug } from "@/components/admin/slug-input";
import { Field, Panel } from "@/components/admin/ui";
import { createProduct, updateProduct } from "@/app/admin/_actions/products";
import { VARIANT_SIZES, type Category, type ProductWithVariants } from "@/lib/types";

export function ProductForm({
  product,
  categories,
}: {
  product?: ProductWithVariants;
  categories: Category[];
}) {
  const isEdit = Boolean(product);
  const variantFor = (size: string) =>
    product?.product_variants?.find((variant) => variant.size === size);

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

          <Field label="Category">
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
        </div>
      </Panel>

      <Panel
        title="Sizes, prices and stock"
        description="Set a price to put a size on sale. Leave it at 0 to keep that size off the shop."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-bark-500">
              <tr>
                <th className="pb-2 pr-4 font-medium">Size</th>
                <th className="pb-2 pr-4 font-medium">Price (Rp)</th>
                <th className="pb-2 pr-4 font-medium">Stock (bags)</th>
                <th className="pb-2 pr-4 font-medium">Shipping weight (g)</th>
                <th className="pb-2 font-medium">On sale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bark-200">
              {VARIANT_SIZES.map((size) => {
                const variant = variantFor(size);
                const defaultWeight = size === "100g" ? 130 : size === "200g" ? 240 : 1100;

                return (
                  <tr key={size}>
                    <td className="py-3 pr-4 font-medium">{size}</td>
                    <td className="py-3 pr-4">
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        name={`price_${size}`}
                        className="input w-32"
                        defaultValue={variant?.price_idr ?? 0}
                      />
                    </td>
                    <td className="py-3 pr-4">
                      <input
                        type="number"
                        min="0"
                        name={`stock_${size}`}
                        className="input w-24"
                        defaultValue={variant?.stock ?? 0}
                      />
                    </td>
                    <td className="py-3 pr-4">
                      <input
                        type="number"
                        min="0"
                        name={`weight_${size}`}
                        className="input w-24"
                        defaultValue={variant?.weight_grams || defaultWeight}
                      />
                    </td>
                    <td className="py-3">
                      <input
                        type="checkbox"
                        name={`active_${size}`}
                        defaultChecked={variant ? variant.is_active : true}
                        className="h-4 w-4 rounded border-bark-300"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-bark-500">
          Stock comes down automatically when an order is paid for. You only need
          to top it up here after a roast.
        </p>
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
            hint="Square images work best. Without one, the card shows the name on the accent colour."
          />

          <Field label="Image description" hint="Describes the photo for screen readers and search engines.">
            <input
              name="image_alt"
              className="input"
              defaultValue={product?.image_alt ?? ""}
              placeholder="A bag of Gayo Arunika on a wooden table"
            />
          </Field>

          <ColorPicker
            name="accent_color"
            label="Card accent colour"
            defaultValue={product?.accent_color ?? "#8c6144"}
            hint="The colour behind this product on the shop grid."
          />

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={product ? product.is_active : true}
                className="h-4 w-4 rounded border-bark-300"
              />
              Show on the shop
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="is_featured"
                defaultChecked={product?.is_featured ?? false}
                className="h-4 w-4 rounded border-bark-300"
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
