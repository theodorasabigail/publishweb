import type { SupabaseClient } from "@supabase/supabase-js";
import type { SiteSettings } from "@/lib/types";
import { applySpendDiscount } from "./discounts";
import { listZones, priceZone, resolveZone } from "./flat-zones";
import {
  BITESHIP_API,
  authHeader,
  classifyFailure,
  courierList,
  dropOffAllowed,
  offersPickup,
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
      // A postal code can cover several kelurahan, and couriers price the
      // area rather than the code. When the customer picked their area from
      // the lookup we know exactly which one, so we say so.
      const destinationArea = destination.areaId?.trim() || null;

      // Without both ends there is nothing to ask, and asking anyway would
      // spend a request to get an error back.
      if (!Number.isFinite(originPostal) || (!destinationArea && !Number.isFinite(destinationPostal))) {
        return fallback();
      }

      const dimensions = estimateDimensions(parcel.weightGrams);

      const body: BiteshipRateRequest = {
        origin_postal_code: originPostal,
        // One or the other, never both: sending a code and an area that
        // disagree leaves the courier to pick, and which one it picks is not
        // documented.
        ...(destinationArea
          ? { destination_area_id: destinationArea }
          : { destination_postal_code: destinationPostal }),
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
        } else if (failure.kind === "balance") {
          // Also permanent until a human acts, and also silent to customers,
          // so it gets the same volume as an auth failure.
          console.error(
            `biteship: OUT OF CREDIT — live rates are not working and every ` +
              `quote is falling back to flat rates. Top up the Biteship ` +
              `account. ${failure.message}`,
          );
        } else {
          console.warn(`biteship: ${failure.kind} failure, using flat rate`, failure.message);
        }
        return fallback();
      }

      const allOptions = parseRateOptions(payload);

      // Drop services that will not collect from the roastery. Biteship's own
      // example has a drop-off-only courier as the cheapest option by a wide
      // margin, so picking on price alone would routinely quote a rate that
      // commits someone to a trip to a depot.
      const options = dropOffAllowed()
        ? allOptions
        : allOptions.filter(offersPickup);

      if (!options.length && allOptions.length) {
        console.warn(
          "biteship: every option was drop-off only, using flat rate. " +
            "Set BITESHIP_ALLOW_DROP_OFF=true to accept them.",
        );
        return fallback();
      }

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

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

export interface BiteshipDiagnosis {
  ok: boolean;
  /** Short headline for the admin. */
  summary: string;
  /** What to actually do about it, when something is wrong. */
  advice: string | null;
  options: { label: string; priceIdr: number; duration: string | null; collects: boolean }[];
  originPostalCode: string | null;
}

/**
 * Try a real quote and report what happened, in words.
 *
 * The provider itself falls back silently on purpose — a customer must never
 * see a courier problem. That silence makes "is this working?" impossible to
 * answer from the shop, so this exists to answer it from the admin instead.
 */
export async function diagnoseBiteship(
  supabase: SupabaseClient,
  destinationPostalCode: string,
): Promise<BiteshipDiagnosis> {
  const { data: settingsRow } = await supabase
    .from("site_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  const settings = settingsRow as SiteSettings | null;
  const originPostalCode = settings?.origin_postal_code ?? null;

  const base: Pick<BiteshipDiagnosis, "options" | "originPostalCode"> = {
    options: [],
    originPostalCode,
  };

  if (!process.env.BITESHIP_API_KEY) {
    return {
      ...base,
      ok: false,
      summary: "No Biteship key is set.",
      advice:
        "Add BITESHIP_API_KEY in Vercel → Settings → Environment Variables, then redeploy.",
    };
  }

  if (!originPostalCode || !Number.isFinite(Number(originPostalCode))) {
    return {
      ...base,
      ok: false,
      summary: "Your pickup postcode is missing.",
      advice:
        "Fill in the postcode under “Where you ship from” above and save. Without it we cannot ask what a delivery costs, so every order quietly uses your own price list instead.",
    };
  }

  if (!Number.isFinite(Number(destinationPostalCode))) {
    return { ...base, ok: false, summary: "That destination postcode is not a number.", advice: null };
  }

  const body: BiteshipRateRequest = {
    origin_postal_code: Number(originPostalCode),
    destination_postal_code: Number(destinationPostalCode),
    couriers: courierList(),
    items: [
      {
        name: "Coffee",
        description: "Test parcel",
        value: 250_000,
        weight: 500,
        quantity: 1,
        ...estimateDimensions(500),
      },
    ],
  };

  let response: Response;
  try {
    response = await fetch(`${BITESHIP_API}/v1/rates/couriers`, {
      method: "POST",
      headers: { authorization: authHeader(), "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return {
      ...base,
      ok: false,
      summary: "Could not reach Biteship.",
      advice:
        "They may be down, or the request timed out. Customers are unaffected — the shop is using your own price list. Try again in a few minutes.",
    };
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    return { ...base, ok: false, summary: "Biteship sent something we could not read.", advice: null };
  }

  if (!response.ok) {
    const failure = classifyFailure(response.status, payload);
    if (failure.kind === "balance") {
      return {
        ...base,
        ok: false,
        summary: "Biteship needs credit on your account before it will quote.",
        advice:
          "Everything else is right — the key works and the request was accepted, it just was not paid for. Their rates API bills per lookup from a prepaid balance, and Testing Mode does not exempt it. Top up in the Biteship dashboard and press this again. Nothing is broken meanwhile: the shop is quoting from your own price list, exactly as before.",
      };
    }

    return {
      ...base,
      ok: false,
      summary:
        failure.kind === "auth"
          ? "Biteship rejected the key."
          : `Biteship returned an error: ${failure.message}`,
      advice:
        failure.kind === "auth"
          ? "Check BITESHIP_API_KEY in Vercel. If you are testing, make sure it starts with biteship_test. and that Testing Mode was on when you created it."
          : null,
    };
  }

  const all = parseRateOptions(payload);
  if (!all.length) {
    return {
      ...base,
      ok: false,
      summary: "Biteship answered, but offered no couriers for that route.",
      advice:
        "Try a different destination postcode. If every postcode does this, the couriers listed in BITESHIP_COURIERS may not serve your area.",
    };
  }

  const usable = dropOffAllowed() ? all : all.filter(offersPickup);

  return {
    ok: usable.length > 0,
    originPostalCode,
    summary: usable.length
      ? `Working — ${usable.length} courier option${usable.length === 1 ? "" : "s"} for a 500 g parcel.`
      : "Couriers were offered, but none of them will collect from you.",
    advice: usable.length
      ? null
      : "Only drop-off services are available on this route, which would mean taking parcels to a depot yourself. The shop is using your own price list instead.",
    options: all.map((o) => ({
      label: [o.courierName, o.serviceName].filter(Boolean).join(" ") || "Courier",
      priceIdr: o.priceIdr,
      duration: o.durationText,
      collects: offersPickup(o),
    })),
  };
}
