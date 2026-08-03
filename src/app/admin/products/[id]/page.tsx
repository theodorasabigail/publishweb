import Link from "next/link";
import { notFound } from "next/navigation";
import { Copy, ExternalLink, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/product-form";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Category, ProductWithVariants } from "@/lib/types";
import { deleteProduct, duplicateProduct } from "@/app/admin/_actions/products";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; duplicated?: string }>;
}) {
  const { id } = await params;
  const { saved, duplicated } = await searchParams;

  const supabase = createAdminClient();
  const [{ data: product }, { data: categories }] = await Promise.all([
    supabase
      .from("products")
      .select("*, product_variants (*)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("categories").select("*").order("sort_order"),
  ]);

  if (!product) notFound();
  const typed = product as ProductWithVariants;

  return (
    <div>
      <PageHeader
        title={typed.name}
        description={typed.is_active ? "Live on the shop." : "Hidden from the shop."}
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/shop/${typed.slug}`}
              target="_blank"
              className="btn-secondary py-2 text-xs"
            >
              <ExternalLink className="h-3.5 w-3.5" /> View
            </Link>
            <form action={duplicateProduct}>
              <input type="hidden" name="id" value={typed.id} />
              <button type="submit" className="btn-secondary py-2 text-xs">
                <Copy className="h-3.5 w-3.5" /> Duplicate
              </button>
            </form>
          </div>
        }
      />

      {(saved || duplicated) && (
        <p className="mb-5 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {duplicated
            ? "Copied. This is the new product — it starts hidden, with zero stock."
            : "Saved. The shop has been updated."}
        </p>
      )}

      <ProductForm product={typed} categories={(categories ?? []) as Category[]} />

      <form action={deleteProduct} className="mt-10 border-t border-bark-200 pt-6">
        <input type="hidden" name="id" value={typed.id} />
        <p className="text-sm text-bark-600">
          Deleting removes this product from the shop for good. Past orders keep
          their own copy of the name and price, so order history is unaffected.
        </p>
        <button type="submit" className="btn-danger mt-3 py-2 text-xs">
          <Trash2 className="h-3.5 w-3.5" /> Delete this product
        </button>
      </form>
    </div>
  );
}
