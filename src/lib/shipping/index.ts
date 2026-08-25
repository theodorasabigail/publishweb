import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { createBiteshipProvider } from "./biteship-provider";
import { assertKeyMatchesEnvironment } from "./biteship";
import { createFlatZoneProvider } from "./flat-zones";
import type { ShippingProvider } from "./types";

export * from "./types";
export { applySpendDiscount, type AppliedDiscount } from "./discounts";
export { createBiteshipProvider } from "./biteship-provider";
export {
  createFlatZoneProvider,
  isJavaProvince,
  listZones,
  parcelWeight,
  priceZone,
  resolveZone,
} from "./flat-zones";

/**
 * The active shipping provider, chosen by SHIPPING_PROVIDER.
 *
 * Only flat zones exist today. Adding Biteship (the spec's v2 upgrade) means
 * writing `biteship.ts` against the ShippingProvider interface and adding a
 * case here — checkout, the quote API and the order record stay untouched.
 * See docs/SHIPPING.md.
 */
export function getShippingProvider(supabase: SupabaseClient): ShippingProvider {
  const id = (env.optional("SHIPPING_PROVIDER") ?? "flat_zones").toLowerCase();

  switch (id) {
    case "flat_zones":
      return createFlatZoneProvider(supabase);
    case "biteship":
      // Guard against a live key in preview or a test key masquerading as
      // production. Throws early with a message that says which and how to
      // fix, rather than silently mispricing every checkout. `VERCEL_ENV`
      // is what Vercel sets ("production" / "preview" / "development");
      // NODE_ENV is the fallback for anywhere else.
      assertKeyMatchesEnvironment(
        (env.optional("VERCEL_ENV") ?? process.env.NODE_ENV) === "production",
      );
      return createBiteshipProvider(supabase);
    default:
      throw new Error(
        `Unknown SHIPPING_PROVIDER "${id}". Set it to "flat_zones" or "biteship", or leave it unset.`,
      );
  }
}
