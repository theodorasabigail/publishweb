import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShippingZone } from "@/lib/types";

/**
 * Shipping, v1: flat-rate zones held in the `shipping_zones` table and edited
 * from the admin. Two weight tiers per zone, padded rates, no external
 * dependency and no per-query cost.
 *
 * The v2 upgrade is Biteship live rates. Everything above this module talks to
 * `quoteShipping` / `listZones` only, so that swap means adding a second
 * implementation of `ShippingQuote` -- not touching checkout.
 */

export interface ShippingQuote {
  zoneCode: string;
  zoneName: string;
  amountIdr: number;
  estimate: string | null;
  isFree: boolean;
}

/** Provinces on Java. Used only to split the two domestic rate bands. */
const JAWA_PROVINCES = [
  "aceh-no", // placeholder guard, never matched
  "banten",
  "dki jakarta",
  "jakarta",
  "jawa barat",
  "west java",
  "jawa tengah",
  "central java",
  "jawa timur",
  "east java",
  "di yogyakarta",
  "yogyakarta",
];

export function isJavaProvince(province: string | null | undefined): boolean {
  if (!province) return false;
  const normalised = province.trim().toLowerCase();
  return JAWA_PROVINCES.slice(1).some(
    (p) => normalised === p || normalised.includes(p),
  );
}

export async function listZones(supabase: SupabaseClient): Promise<ShippingZone[]> {
  const { data } = await supabase
    .from("shipping_zones")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  return (data ?? []) as ShippingZone[];
}

/**
 * Pick the zone for a destination. Indonesia splits on province; every other
 * country matches by country code, falling back to the catch-all zone.
 */
export function resolveZone(
  zones: ShippingZone[],
  country: string,
  province?: string | null,
): ShippingZone | null {
  const code = (country || "ID").trim().toUpperCase();

  if (code === "ID") {
    const wanted = isJavaProvince(province) ? "id-jawa" : "id-luar";
    return (
      zones.find((z) => z.code === wanted) ??
      zones.find((z) => z.is_domestic) ??
      null
    );
  }

  const match = zones.find((z) => z.country_codes.includes(code));
  if (match) return match;

  return zones.find((z) => z.code === "rest") ?? null;
}

/** Flat rate for a zone, given the parcel weight and order subtotal. */
export function quoteShipping(
  zone: ShippingZone,
  weightGrams: number,
  subtotalIdr: number,
): ShippingQuote {
  const base =
    weightGrams > zone.threshold_grams && zone.heavy_rate_idr > 0
      ? zone.heavy_rate_idr
      : zone.base_rate_idr;

  const qualifiesForFree =
    zone.free_shipping_over_idr !== null && subtotalIdr >= zone.free_shipping_over_idr;

  return {
    zoneCode: zone.code,
    zoneName: zone.name,
    amountIdr: qualifiesForFree ? 0 : base,
    estimate: zone.delivery_estimate,
    isFree: qualifiesForFree,
  };
}

/** Total parcel weight, with a floor so a missing weight never ships free. */
export function parcelWeight(items: { weightGrams: number; quantity: number }[]): number {
  const total = items.reduce(
    (sum, item) => sum + Math.max(item.weightGrams, 0) * item.quantity,
    0,
  );
  return total > 0 ? total : 250;
}
