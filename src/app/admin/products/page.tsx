import Link from "next/link";
import { Plus } from "lucide-react";
import { EmptyRow, PageHeader } from "@/components/admin/ui";
import { ProductList } from "@/components/admin/product-list";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ProductWithVariants } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("products")
    .select("*, product_variants (*), categories ( id, slug, name )")
    .order("sort_order")
    .order("created_at", { ascending: false });

  const products = (data ?? []) as ProductWithVariants[];

  return (
    <div>
      <PageHeader
        title="Products"
        description="Drag a row to change the order coffees appear in on the shop."
        action={
          <Link href="/admin/products/new" className="btn-primary">
            <Plus className="h-4 w-4" /> New product
          </Link>
        }
      />

      {products.length ? (
        <ProductList products={products} />
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
