import { PageHeader } from "@/components/admin/ui";
import { PosTerminal } from "@/components/admin/pos-terminal";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { getSiteSettings } from "@/lib/queries";
import { sortVariants } from "@/lib/product";
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

  // Same size ordering as the storefront, from the same function, so muscle
  // memory transfers and a size the operator invents lands in the same place
  // in both.
  const products = sortVariants((data ?? []) as ProductWithVariants[]);

  return (
    <div>
      <PageHeader
        title="Counter sales"
        description="Ring up a sale in the shop, or write down one that came in over WhatsApp or Instagram. Stock and takings go into the same books as the website."
      />
      <PosTerminal products={products} rupiahPerPoint={settings.loyalty_rupiah_per_point} />
    </div>
  );
}
