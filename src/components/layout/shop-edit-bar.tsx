"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ExternalLink, Pencil, Table2, X } from "lucide-react";
import { shopEditorFor } from "@/app/admin/_actions/shop-editor";
import {
  updateProductField,
  updateVariantField,
  type ProductField,
  type QuickResult,
  type VariantField,
} from "@/app/admin/_actions/quick-edit";
import { StockCell, TextCell, ToggleCell } from "@/components/admin/edit-cells";
import type { ProductWithVariants } from "@/lib/types";

/**
 * Edit the shop while looking at it.
 *
 * For a signed-in admin, every shop page gets a small button. On a coffee's
 * page it opens a panel beside the page with that coffee's name, notes,
 * description and every size's price, stock and availability; each field
 * saves as you leave it and the page behind refreshes, so the change is seen
 * exactly as a customer will see it. Elsewhere the button goes to the
 * products sheet.
 *
 * Nobody else sees anything: the check runs after the page has loaded (the
 * shop itself never reads the session, so it can stay cached) and returns
 * nothing for anyone who is not an admin.
 */

const AUTH_COOKIE = /(^|;\s*)sb-[^=;]*auth-token[^=;]*=/;

function slugFrom(pathname: string): string | null {
  const match = pathname.match(/^\/shop\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function ShopEditBar() {
  const pathname = usePathname();
  const router = useRouter();
  const slug = slugFrom(pathname);
  const [state, setState] = useState<{
    path: string;
    admin: boolean;
    product: ProductWithVariants | null;
  } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // No sign-in cookie, no question to ask: the common case costs nothing.
    if (!AUTH_COOKIE.test(document.cookie)) return;
    let live = true;
    shopEditorFor(slug)
      .then((result) => {
        if (live) setState({ path: pathname, ...result });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [pathname, slug]);

  // Answers for a page we have since left are not shown.
  const current = state && state.path === pathname ? state : null;
  if (!current?.admin) return null;

  const product = current.product;

  if (!product) {
    return (
      <Link
        href="/admin/products/sheet"
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-sea-800 px-4 py-2.5 text-sm text-cream shadow-lg hover:bg-sea-900"
      >
        <Table2 className="h-4 w-4" /> Edit products
      </Link>
    );
  }

  /** Save, then refresh the page behind so the change shows as customers see it. */
  const saveProduct = (field: ProductField) => async (value: string | boolean): Promise<QuickResult> => {
    const result = await updateProductField(product.id, field, value);
    if (result.ok) router.refresh();
    return result;
  };
  const saveVariant =
    (id: string, field: VariantField) =>
    async (value: string | boolean): Promise<QuickResult> => {
      const result = await updateVariantField(id, field, value);
      if (result.ok) router.refresh();
      return result;
    };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-sea-800 px-4 py-2.5 text-sm text-cream shadow-lg hover:bg-sea-900"
        >
          <Pencil className="h-4 w-4" /> Edit this coffee
        </button>
      )}

      {open && (
        <aside
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-sea-200 bg-white shadow-2xl"
          aria-label={`Edit ${product.name}`}
        >
          <div className="flex items-center justify-between border-b border-sea-200 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Editing this coffee</p>
              <p className="text-xs text-sea-800">Each change saves as you leave the field.</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded p-1.5 text-sea-800 hover:bg-sea-100"
              aria-label="Close the editor"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            <Field label="Name">
              <TextCell key={`name:${product.name}`} col="shop-name" value={product.name} onSave={saveProduct("name")} className="border-sea-200 font-medium" />
            </Field>

            <div className="flex items-center justify-between rounded-lg border border-sea-200 px-3 py-2">
              <span className="text-sm">Shown on the shop</span>
              <ToggleCell
                key={`active:${product.is_active}`}
                value={product.is_active}
                onSave={saveProduct("is_active")}
                label="Shown on the shop"
              />
            </div>
            {!product.is_active && (
              <p className="-mt-2 text-xs text-amber-800">
                Hidden from the shop: customers now get &ldquo;not found&rdquo; at this
                address. Switch it back on here whenever it is ready.
              </p>
            )}

            <Field label="Tasting notes">
              <TextCell
                key={`notes:${product.tasting_notes ?? ""}`}
                col="shop-notes"
                value={product.tasting_notes ?? ""}
                onSave={saveProduct("tasting_notes")}
                placeholder="Chocolate, plum…"
                className="border-sea-200"
              />
            </Field>

            <Field label="Description">
              <TextCell
                key={`desc:${product.description ?? ""}`}
                col="shop-description"
                value={product.description ?? ""}
                onSave={saveProduct("description")}
                multiline
                className="border-sea-200"
              />
            </Field>

            <div>
              <p className="mb-1 text-xs uppercase tracking-wider text-sea-800">Sizes</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-sea-800">
                    <th className="pb-1 font-normal">Size</th>
                    <th className="pb-1 pr-2 text-right font-normal">Price (Rp)</th>
                    <th className="pb-1 pr-3 text-right font-normal">Stock</th>
                    <th className="pb-1 font-normal">On sale</th>
                  </tr>
                </thead>
                <tbody>
                  {product.product_variants.map((variant) => (
                    <tr key={variant.id} className="align-top">
                      <td className="py-1 pr-1">
                        <TextCell key={variant.size} col="shop-size" value={variant.size} onSave={saveVariant(variant.id, "size")} className="w-20" />
                      </td>
                      <td className="py-1 pr-1">
                        <TextCell key={variant.price_idr} col="shop-price" value={String(variant.price_idr)} onSave={saveVariant(variant.id, "price_idr")} numeric className="w-24 text-right" />
                      </td>
                      <td className="py-1 pr-1">
                        <StockCell key={variant.stock} variantId={variant.id} stock={variant.stock} reserved={variant.reserved} onSaved={() => router.refresh()} />
                      </td>
                      <td className="py-1">
                        <ToggleCell
                          key={String(variant.is_active)}
                          value={variant.is_active}
                          onSave={saveVariant(variant.id, "is_active")}
                          label={`${variant.size} on sale`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-sea-200 px-4 py-3 text-xs">
            <Link href={`/admin/products/${product.id}`} className="flex items-center gap-1 text-sea-800 hover:underline">
              Photo, origin & SEO <ExternalLink className="h-3 w-3" />
            </Link>
            <Link href="/admin/products/sheet" className="flex items-center gap-1 text-sea-800 hover:underline">
              All coffees as a sheet <Table2 className="h-3 w-3" />
            </Link>
          </div>
        </aside>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs uppercase tracking-wider text-sea-800">{label}</p>
      {children}
    </div>
  );
}
