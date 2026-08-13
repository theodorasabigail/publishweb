import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShippingZone } from "@/lib/types";
import { applySpendDiscount } from "./discounts";
import type {
  ShippingDestination,
  ShippingParcel,
  ShippingProvider,
  ShippingQuote,
} from "./types";

/**
 * v1: flat-rate zones from the `shipping_zones` table, edited in the admin.
 * Two weight tiers per zone, plus an optional two-step spend discount.
 * No external dependency and no per-query cost.
 */

/** Provinces on Java. Used only to split the two domestic rate bands. */
const JAVA_PROVINCES = [
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
  return JAVA_PROVINCES.some((p) => normalised === p || normalised.includes(p));
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
    return zones.find((z) => z.code === wanted) ?? zones.find((z) => z.is_domestic) ?? null;
  }

  const match = zones.find((z) => z.country_codes.includes(code));
  if (match) return match;

  return zones.find((z) => z.code === "rest") ?? null;
}

/**
 * Price one zone.
 *
 * Discount tiers are checked most-generous first, so a customer who clears the
 * free threshold is never charged the smaller subsidy instead.
 */
export function priceZone(
  zone: ShippingZone,
  weightGrams: number,
  subtotalIdr: number,
): ShippingQuote {
  const fullRateIdr =
    weightGrams > zone.threshold_grams && zone.heavy_rate_idr > 0
      ? zone.heavy_rate_idr
      : zone.base_rate_idr;

  // Discount policy comes from the zone and is shared with every provider, so
  // a live-rate integration inherits it for free.
  const { discountIdr, discountLabel } = applySpendDiscount(
    fullRateIdr,
    subtotalIdr,
    zone,
  );

  const amountIdr = Math.max(0, fullRateIdr - discountIdr);

  return {
    zoneCode: zone.code,
    zoneName: zone.name,
    fullRateIdr,
    discountIdr,
    amountIdr,
    isFree: amountIdr === 0,
    estimate: zone.delivery_estimate,
    discountLabel,
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

export function createFlatZoneProvider(supabase: SupabaseClient): ShippingProvider {
  return {
    id: "flat_zones",
    label: "Flat rate by zone",
    isLiveRate: false,

    async quote(
      destination: ShippingDestination,
      parcel: ShippingParcel,
    ): Promise<ShippingQuote | null> {
      const zones = await listZones(supabase);
      const zone = resolveZone(zones, destination.country, destination.province);
      if (!zone) return null;
      return priceZone(zone, parcel.weightGrams, parcel.subtotalIdr);
    },
  };
}
