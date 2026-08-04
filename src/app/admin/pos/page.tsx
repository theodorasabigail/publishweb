import { PageHeader } from "@/components/admin/ui";
import { PosTerminal } from "@/components/admin/pos-terminal";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { getSiteSettings } from "@/lib/queries";
import type { ProductWithVariants } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PosPage() {
  if (!isSupabaseConfigured()) return null;

  const supabase = createAdminClient();
  const [{ data }, settings] = await Promise.all([
    supabase
      .from("products")
      .select("*, product_variants (*)")
      .eq("is_active", true)
      .order("sort_order"),
    getSiteSettings(supabase),
  ]);

  // Same size ordering as the storefront, so muscle memory transfers.
  const order: Record<string, number> = { "100g": 0, "200g": 1, "1kg": 2 };
  const products = ((data ?? []) as ProductWithVariants[]).map((product) => ({
    ...product,
    product_variants: (product.product_variants ?? [])
      .filter((variant) => variant.is_active)
      .sort((a, b) => (order[a.size] ?? 9) - (order[b.size] ?? 9)),
  }));

  return (
    <div>
      <PageHeader
        title="Counter sales"
        description="Ring up a sale in the shop. Stock and takings go into the same books as the website."
      />
      <PosTerminal products={products} rupiahPerPoint={settings.loyalty_rupiah_per_point} />
    </div>
  );
}
