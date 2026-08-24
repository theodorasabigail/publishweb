import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Biteship API client and webhook parsing.
 *
 * Deliberately not a ShippingProvider yet: the rates request/response shape is
 * still needed from their docs, and guessing it produces code that looks right
 * and fails on first contact. Everything here is built on documented facts —
 * the endpoint, the auth scheme, the error codes and the webhook payloads.
 */

export const BITESHIP_API =
  process.env.BITESHIP_API_BASE ?? "https://api.biteship.com";

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

/**
 * Biteship's documentation contradicts itself on this. The prose describes
 * HTTP Basic auth with the token as the password; the curl example alongside
 * it sends the raw token with no scheme:
 *
 *   --header 'authorization: <<YOUR_API_KEY>>'
 *
 * The concrete example is the more reliable of the two, so raw is the default.
 * If sandbox returns an auth error, flip this to "basic" — that is the whole
 * fix, and it is here rather than inline so it is one edit.
 */
const AUTH_STYLE: "raw" | "basic" = "raw";

export function authHeader(): string {
  const key = env.optional("BITESHIP_API_KEY");
  if (!key) {
    throw new Error(
      "Missing BITESHIP_API_KEY. Add it in Vercel → Settings → Environment Variables, or set SHIPPING_PROVIDER=flat_zones.",
    );
  }
  if (AUTH_STYLE === "basic") {
    return `Basic ${Buffer.from(`:${key}`).toString("base64")}`;
  }
  return key;
}

/** Biteship prefixes every token `biteship_test.` or `biteship_live.`. A live
 *  key in a preview deploy books real couriers, so it is worth refusing. */
export function assertKeyMatchesEnvironment(isProduction: boolean): void {
  const key = env.optional("BITESHIP_API_KEY");
  if (!key) return;

  const isLiveKey = key.startsWith("biteship_live.");
  const isTestKey = key.startsWith("biteship_test.");

  if (!isLiveKey && !isTestKey) {
    throw new Error(
      "BITESHIP_API_KEY does not look like a Biteship token — they start with biteship_test. or biteship_live.",
    );
  }
  if (isLiveKey && !isProduction) {
    throw new Error(
      "A live Biteship key is set on a non-production deploy. Use a biteship_test. key there.",
    );
  }
}

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

/** Auth failures documented by Biteship. Retrying these never helps. */
const AUTH_ERROR_CODES = new Set([
  "40000001",
  "40101001",
  "40101002",
  "40101003",
  "40301001",
  "40301002",
]);

export type BiteshipFailure =
  /** Wrong or revoked key. Quotes have silently stopped being live — fall back
   *  to flat zones AND tell the operator, because this will not self-heal. */
  | { kind: "auth"; code: string; message: string }
  /** The account has no prepaid credit left. Same handling as auth — silent
   *  fallback for the customer, loud for the operator — but a different fix,
   *  and worth naming separately because "rejected the key" would send them
   *  hunting through Vercel for a problem that is not there. */
  | { kind: "balance"; message: string }
  /** Timeout, 5xx, network. Fall back quietly and carry on. */
  | { kind: "transient"; message: string }
  /** A request we built wrong. Worth logging loudly in development. */
  | { kind: "request"; code: string; message: string };

export function classifyFailure(status: number, body: unknown): BiteshipFailure {
  const payload = body as { code?: number | string; error?: string; message?: string } | null;
  const code = payload?.code !== undefined ? String(payload.code) : "";
  const message = payload?.error ?? payload?.message ?? `HTTP ${status}`;

  // Matched on the text because Biteship documents no code for it. Checked
  // before auth: a balance failure can arrive as a 4xx that would otherwise
  // look like a rejected key.
  if (/insufficient|sufficient balance|top up|topup|saldo/i.test(message)) {
    return { kind: "balance", message };
  }
  if (AUTH_ERROR_CODES.has(code) || status === 401 || status === 403) {
    return { kind: "auth", code, message };
  }
  if (status >= 500 || status === 408 || status === 429) {
    return { kind: "transient", message };
  }
  return { kind: "request", code, message };
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

/**
 * Biteship's webhook documentation gives the payloads but does not describe
 * how to verify a call actually came from them — there is no documented
 * signature header, unlike Xendit's callback token or Moota's HMAC.
 *
 * An unauthenticated endpoint that moves order state and records prices is not
 * acceptable, so a shared secret is required in the query string and the URL
 * configured in their dashboard carries it:
 *
 *   https://your-domain.com/api/webhooks/biteship?token=<BITESHIP_WEBHOOK_SECRET>
 *
 * This is a workaround, not a substitute for signing. Ask Biteship support
 * whether signature verification exists; if it does, it belongs here instead.
 */
export function verifyWebhookSecret(url: URL): boolean {
  const expected = env.optional("BITESHIP_WEBHOOK_SECRET");
  if (!expected) return false;

  const provided = url.searchParams.get("token") ?? "";
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type BiteshipWebhook =
  | {
      event: "order.status";
      courierOrderId: string;
      status: string | null;
      waybillId: string | null;
      trackingId: string | null;
      company: string | null;
      type: string | null;
      driverName: string | null;
      driverPhone: string | null;
    }
  | {
      event: "order.price";
      courierOrderId: string;
      status: string | null;
      /** What the courier is actually charging, after real weight. */
      priceIdr: number | null;
      waybillId: string | null;
    }
  | {
      event: "order.waybill_id";
      courierOrderId: string;
      status: string | null;
      waybillId: string | null;
      trackingId: string | null;
    }
  | { event: "unknown"; raw: unknown };

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function int(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function parseWebhook(body: unknown): BiteshipWebhook {
  const payload = body as Record<string, unknown> | null;
  if (!payload || typeof payload !== "object") return { event: "unknown", raw: body };

  const courierOrderId = str(payload.order_id);
  const status = str(payload.status);

  switch (payload.event) {
    case "order.status":
      if (!courierOrderId) return { event: "unknown", raw: body };
      return {
        event: "order.status",
        courierOrderId,
        status,
        waybillId: str(payload.courier_waybill_id),
        trackingId: str(payload.courier_tracking_id),
        company: str(payload.courier_company),
        type: str(payload.courier_type),
        driverName: str(payload.courier_driver_name),
        driverPhone: str(payload.courier_driver_phone),
      };

    case "order.price":
      if (!courierOrderId) return { event: "unknown", raw: body };
      return {
        event: "order.price",
        courierOrderId,
        status,
        // Their docs show both `price` and a misspelled `shippment_fee`; price
        // is the one described as what will be charged.
        priceIdr: int(payload.price),
        waybillId: str(payload.courier_waybill_id),
      };

    case "order.waybill_id":
      if (!courierOrderId) return { event: "unknown", raw: body };
      return {
        event: "order.waybill_id",
        courierOrderId,
        status,
        waybillId: str(payload.courier_waybill_id),
        trackingId: str(payload.courier_tracking_id),
      };

    default:
      return { event: "unknown", raw: body };
  }
}

/**
 * Courier statuses that mean the parcel has physically left. Used to move our
 * own order status along, so the operator does not have to.
 *
 * Deliberately conservative: an unrecognised status changes nothing rather
 * than guessing, because a wrong "delivered" is worse than a missing one.
 */
const SHIPPED_STATUSES = new Set(["picked", "dropping_off", "in_transit", "on_delivery"]);
export function orderStatusFor(courierStatus: string | null): "shipped" | null {
  if (!courierStatus) return null;
  const normalised = courierStatus.trim().toLowerCase();
  // Delivered used to promote to `completed`, but the shop does not track
  // delivery as a distinct state -- `shipped` is terminal for anything posted.
  if (SHIPPED_STATUSES.has(normalised)) return "shipped";
  return null;
}

// ---------------------------------------------------------------------------
// Rates
// ---------------------------------------------------------------------------

/**
 * Request shape, corroborated from two independent community integrations
 * (the `biteship-wrapper` npm package and an n8n community node) since the
 * official docs page is not reachable from this environment:
 *
 *   {
 *     origin_postal_code: 12410,
 *     destination_postal_code: 12430,
 *     couriers: "jne,sicepat,anteraja",   // comma-separated, not an array
 *     items: [{ name, description, value, length, width, height, weight, quantity }]
 *   }
 *
 * `weight` is in **grams**, which the n8n node labels explicitly and which
 * matches our own `weight_grams` column — so no conversion, and nothing to get
 * silently wrong by a factor of a thousand.
 *
 * Origin and destination can instead be given as `*_area_id` or as
 * `*_latitude`/`*_longitude`. Postal code is used here because checkout
 * already collects one and it needs no extra lookup call — which would be a
 * second request and therefore a second charge.
 */
export interface BiteshipRateRequest {
  origin_postal_code?: number;
  origin_area_id?: string;
  destination_postal_code?: number;
  destination_area_id?: string;
  couriers: string;
  items: {
    name: string;
    description?: string;
    value: number;
    length?: number;
    width?: number;
    height?: number;
    weight: number;
    quantity: number;
  }[];
}

export interface BiteshipOption {
  /** The final price, after any Custom Rate discount or surcharge configured
   *  in the Biteship dashboard, and after insurance/COD if those were asked
   *  for. Their docs are explicit that this is the field to charge on — using
   *  `shipping_fee` instead would silently ignore Custom Rates. */
  priceIdr: number;
  courierName: string | null;
  serviceName: string | null;
  durationText: string | null;
  /** "pickup" means the courier collects from the roastery; "drop_off" means
   *  someone has to take the parcel to a depot. Quoting a drop-off price for a
   *  service you assumed would collect is a nasty operational surprise. */
  collectionMethods: string[];
  courierCode: string | null;
  serviceCode: string | null;
}

/**
 * Read the rate options out of a response.
 *
 * Shape confirmed against Biteship's published example: a `pricing` array of
 * objects carrying `price`, `courier_name`, `courier_service_name`,
 * `duration` and `available_collection_method`. The alternative keys below are
 * kept as cheap insurance — if the shape ever moves, this returns nothing and
 * the caller falls back to flat rates rather than guessing a price.
 */
export function parseRateOptions(body: unknown): BiteshipOption[] {
  const payload = body as Record<string, unknown> | null;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];

  const candidate =
    (Array.isArray(payload.pricing) && payload.pricing) ||
    (Array.isArray(payload.rates) && payload.rates) ||
    (Array.isArray(payload.data) && payload.data) ||
    null;

  if (!candidate) return [];

  const options: BiteshipOption[] = [];

  for (const entry of candidate) {
    const row = entry as Record<string, unknown>;
    if (!row || typeof row !== "object") continue;

    const price = int(row.price ?? row.shipping_fee);
    if (price === null || price < 0) continue;

    const duration =
      str(row.duration) ??
      (row.shipment_duration_range && row.shipment_duration_unit
        ? `${String(row.shipment_duration_range)} ${String(row.shipment_duration_unit)}`
        : null);

    options.push({
      priceIdr: price,
      courierName: str(row.courier_name) ?? str(row.company) ?? str(row.courier_code),
      serviceName: str(row.courier_service_name) ?? str(row.courier_service_code),
      durationText: duration,
      collectionMethods: Array.isArray(row.available_collection_method)
        ? row.available_collection_method.filter((m): m is string => typeof m === "string")
        : [],
      courierCode: str(row.courier_code),
      serviceCode: str(row.courier_service_code),
    });
  }

  return options;
}

/**
 * Whether a service will collect from the roastery.
 *
 * Biteship's own example includes a Wahana service at Rp 1.000 that is
 * `drop_off` only — by far the cheapest option, and useless if you expected a
 * driver to arrive. An option with no stated method is treated as acceptable
 * rather than filtered out, since absence is not the same as "no".
 */
export function offersPickup(option: BiteshipOption): boolean {
  if (!option.collectionMethods.length) return true;
  return option.collectionMethods.includes("pickup");
}

/** Set BITESHIP_ALLOW_DROP_OFF=true if someone is happy to drive parcels to a
 *  depot in exchange for a cheaper rate. */
export function dropOffAllowed(): boolean {
  return (env.optional("BITESHIP_ALLOW_DROP_OFF") ?? "").toLowerCase() === "true";
}

/** Which couriers to ask for. Comma-separated, set in the environment so it
 *  can be tuned without a deploy-time code change. */
export function courierList(): string {
  return env.optional("BITESHIP_COURIERS") ?? "jne,sicepat,anteraja,jnt,pos";
}

// ---------------------------------------------------------------------------
// Areas
// ---------------------------------------------------------------------------

/**
 * One place Biteship can deliver to, as their maps endpoint describes it.
 *
 * An Indonesian address is a hierarchy — provinsi, kota/kabupaten, kecamatan,
 * kelurahan — and the generic western `city` / `state` pair loses the middle
 * two entirely. Asking somebody to type them by hand gets them spelled four
 * ways; this is the same list the courier itself rates against, so what the
 * customer picks and what the courier understands are the same thing.
 *
 * `id` is the valuable part. Rates can be requested by `destination_area_id`
 * instead of by postal code, which is both more precise and what a real
 * booking needs.
 */
export interface BiteshipArea {
  id: string;
  /** The whole thing on one line, as Biteship writes it — what a picker shows. */
  label: string;
  province: string | null;
  /** Kota or kabupaten. */
  city: string | null;
  /** Kecamatan. */
  district: string | null;
  /** Kelurahan or desa. */
  village: string | null;
  postalCode: string | null;
}

/**
 * Read the areas out of a maps response.
 *
 * The administrative levels are numbered rather than named in Biteship's
 * payload, and level 4 is absent for some areas, so every field is read
 * defensively: a suggestion missing its kelurahan is still worth offering,
 * and is far better than the free-text box it replaces.
 */
export function parseAreas(body: unknown): BiteshipArea[] {
  const payload = body as { areas?: unknown } | null;
  if (!payload || !Array.isArray(payload.areas)) return [];

  const text = (value: unknown): string | null => {
    if (typeof value === "number") return String(value);
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  };

  return payload.areas.flatMap((entry) => {
    const area = entry as Record<string, unknown>;
    const id = text(area.id);
    if (!id) return [];

    const province = text(area.administrative_division_level_1_name);
    const city = text(area.administrative_division_level_2_name);
    const district = text(area.administrative_division_level_3_name);
    const village = text(area.administrative_division_level_4_name);
    const postalCode = text(area.postal_code);

    // Biteship's own `name` is the readable one-liner. Rebuilt from the parts
    // when it is missing, so the picker never shows a blank row.
    const label =
      text(area.name) ??
      [village, district, city, province, postalCode].filter(Boolean).join(", ");

    return [{ id, label, province, city, district, village, postalCode }];
  });
}
