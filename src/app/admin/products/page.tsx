import Link from "next/link";
import { Plus } from "lucide-react";
import { EmptyRow, PageHeader } from "@/components/admin/ui";
import { ProductList } from "@/components/admin/product-list";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Category, ProductWithVariants } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const supabase = createAdminClient();
  const [{ data }, { data: categoryRows }] = await Promise.all([
    supabase
      .from("products")
      .select("*, product_variants (*), categories!category_id ( id, slug, name )")
      .order("sort_order")
      .order("created_at", { ascending: false }),
    supabase.from("categories").select("*").order("sort_order"),
  ]);

  const products = (data ?? []) as ProductWithVariants[];
  const categories = (categoryRows ?? []) as Category[];

  return (
    <div>
      <PageHeader
        title="Products"
        description="Tick coffees to change prices, stock, flavour or visibility on several at once. Drag a row to change the order they appear in on the shop."
        action={
          <Link href="/admin/products/new" className="btn-primary">
            <Plus className="h-4 w-4" /> New product
          </Link>
        }
      />

      {products.length ? (
        <ProductList products={products} categories={categories} />
      ) : (
        <EmptyRow>
          No products yet.{" "}
          <Link href="/admin/products/new" className="underline">
            Add the first one
          </Link>
          .
        </EmptyRow>
      )}
    </div>
  );
}
