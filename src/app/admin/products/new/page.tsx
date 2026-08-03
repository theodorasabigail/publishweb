import { PageHeader } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/product-form";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Category } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const supabase = createAdminClient();
  const { data } = await supabase.from("categories").select("*").order("sort_order");

  return (
    <div>
      <PageHeader
        title="New product"
        description="Set the details and a price for each size. Sizes with no price stay off the shop."
      />
      <ProductForm categories={(data ?? []) as Category[]} />
    </div>
  );
}
