import type { SupabaseClient } from "@supabase/supabase-js";
import type { SiteSettings } from "@/lib/types";
import { applySpendDiscount } from "./discounts";
import { listZones, priceZone, resolveZone } from "./flat-zones";
import {
  BITESHIP_API,
  authHeader,
  classifyFailure,
  courierList,
  parseRateOptions,
  type BiteshipRateRequest,
} from "./biteship";
import type {
  ShippingDestination,
  ShippingParcel,
  ShippingProvider,
  ShippingQuote,
} from "./types";

/**
 * Live courier rates via Biteship.
 *
 * The single most important behaviour here is the fallback. A courier API
 * being slow, down, misconfigured or answering in an unexpected shape must
 * never stop someone checking out — a slightly wrong shipping price is
 * enormously better than a shop that cannot take orders. So every failure path
 * ends at the flat-rate zone for that destination, which is why the zones stay
 * in the database after switching over.
 */

const TIMEOUT_MS = 6000;

/** Rough box for a parcel of coffee, in centimetres. Couriers price on
 *  volumetric weight when a parcel is bulky; coffee is dense enough that
 *  actual weight almost always wins, so this only needs to be sane. */
function estimateDimensions(weightGrams: number) {
  if (weightGrams <= 300) return { length: 20, width: 12, height: 6 };
  if (weightGrams <= 1200) return { length: 25, width: 18, height: 10 };
  return { length: 35, width: 25, height: 20 };
}

export function createBiteshipProvider(supabase: SupabaseClient): ShippingProvider {
  return {
    id: "biteship",
    label: "Live courier rates (Biteship)",
    isLiveRate: true,

    async quote(
      destination: ShippingDestination,
      parcel: ShippingParcel,
    ): Promise<ShippingQuote | null> {
      const zones = await listZones(supabase);
      const zone = resolveZone(zones, destination.country, destination.province);

      // No zone means we do not ship there at all, live rates or not.
      if (!zone) return null;

      // Flat rate for this destination, used if anything below fails.
      const fallback = () => priceZone(zone, parcel.weightGrams, parcel.subtotalIdr);

      // Biteship is domestic-only here; international keeps the flat zones.
      if (destination.country.trim().toUpperCase() !== "ID") return fallback();

      const { data: settingsRow } = await supabase
        .from("site_settings")
        .select("*")
        .eq("id", true)
        .maybeSingle();
      const settings = settingsRow as SiteSettings | null;

      const originPostal = Number(settings?.origin_postal_code);
      const destinationPostal = Number(destination.postalCode);

      // Without both ends there is nothing to ask, and asking anyway would
      // spend a request to get an error back.
      if (!Number.isFinite(originPostal) || !Number.isFinite(destinationPostal)) {
        return fallback();
      }

      const dimensions = estimateDimensions(parcel.weightGrams);

      const body: BiteshipRateRequest = {
        origin_postal_code: originPostal,
        destination_postal_code: destinationPostal,
        couriers: courierList(),
        // One aggregated item rather than one per line: couriers price on total
        // weight and declared value, and a single item keeps the request small.
        items: [
          {
            name: "Coffee",
            description: "Roasted coffee beans",
            value: parcel.subtotalIdr,
            weight: parcel.weightGrams,
            quantity: 1,
            ...dimensions,
          },
        ],
      };

      let response: Response;
      try {
        response = await fetch(`${BITESHIP_API}/v1/rates/couriers`, {
          method: "POST",
          headers: {
            authorization: authHeader(),
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (error) {
        // Timeout or network. Quiet fallback: this is expected occasionally
        // and there is nothing the operator can do about it.
        console.warn("biteship: rate request failed, using flat rate", error);
        return fallback();
      }

      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        return fallback();
      }

      if (!response.ok) {
        const failure = classifyFailure(response.status, payload);
        if (failure.kind === "auth") {
          // Not transient. Quotes have silently stopped being live and will
          // stay that way until someone fixes the key, so this is loud.
          console.error(
            `biteship: AUTHENTICATION FAILED (${failure.code}) — live rates are ` +
              `not working and every quote is falling back to flat rates. ` +
              `Check BITESHIP_API_KEY. ${failure.message}`,
          );
        } else {
          console.warn(`biteship: ${failure.kind} failure, using flat rate`, failure.message);
        }
        return fallback();
      }

      const options = parseRateOptions(payload);
      if (!options.length) {
        // Either no courier serves this route, or the response shape is not
        // what we expect. Either way the flat rate is the safe answer.
        console.warn("biteship: no usable rate options in response, using flat rate");
        return fallback();
      }

      // Cheapest that actually serves the route. Offering the customer a
      // choice of courier would be a checkout redesign, not a rate change.
      const best = options.reduce((a, b) => (b.priceIdr < a.priceIdr ? b : a));

      // Discount policy still comes from the zone, so free-shipping thresholds
      // work identically whether the base rate is flat or live.
      const { discountIdr, discountLabel } = applySpendDiscount(
        best.priceIdr,
        parcel.subtotalIdr,
        zone,
      );

      const service = [best.courierName, best.serviceName].filter(Boolean).join(" ");

      return {
        zoneCode: zone.code,
        zoneName: service || zone.name,
        fullRateIdr: best.priceIdr,
        discountIdr,
        amountIdr: Math.max(0, best.priceIdr - discountIdr),
        isFree: best.priceIdr - discountIdr <= 0,
        estimate: best.durationText ?? zone.delivery_estimate,
        discountLabel,
      };
    },
  };
}
