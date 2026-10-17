import { PageHeader } from "@/components/admin/ui";
import { ProductSheet } from "@/components/admin/product-sheet";
import { ChangeBox } from "@/components/admin/change-box";
import { PriceImport } from "@/components/admin/price-import";
import { ProductsViewSwitch } from "@/components/admin/products-view-switch";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { sortVariants } from "@/lib/product";
import type { ProductWithVariants } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProductSheetPage() {
  if (!isSupabaseConfigured()) return null;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("products")
    .select("*, product_variants (*)")
    .order("sort_order")
    .order("created_at", { ascending: false });

  const products = sortVariants((data ?? []) as ProductWithVariants[]);

  return (
    <div>
      <PageHeader
        title="Products"
        description="Every coffee on one sheet. Click a cell, type, and press Enter or click away — it saves by itself. Enter moves down the column, so a recount after a roast is type, Enter, type, Enter."
      />
      <ProductsViewSwitch current="sheet" />
      <PriceImport
        catalogue={products.map((product) => ({
          id: product.id,
          name: product.name,
          is_active: product.is_active,
          product_variants: product.product_variants.map((variant) => ({
            id: variant.id,
            size: variant.size,
            price_idr: variant.price_idr,
            is_active: variant.is_active,
          })),
        }))}
      />
      <ChangeBox />
      <ProductSheet products={products} />
    </div>
  );
}
