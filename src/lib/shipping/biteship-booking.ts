import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Order,
  OrderItem,
  ShippingAddressSnapshot,
  SiteSettings,
} from "@/lib/types";
import {
  BITESHIP_API,
  authHeader,
  classifyFailure,
  courierList,
  dropOffAllowed,
  offersPickup,
  parseRateOptions,
  type BiteshipOption,
  type BiteshipRateRequest,
} from "./biteship";

/**
 * Book a shipment against Biteship's Create Order endpoint.
 *
 * This is the "one button" leg of the integration: the shop has taken the
 * order, the money has landed and the address is written down, and this
 * hands the parcel off to the courier without a trip to the Biteship
 * dashboard. Two pieces do the work:
 *
 *   quoteBiteshipForOrder  -- re-runs rates against the *actual* parcel
 *                              (address + real weights from variants), so
 *                              the operator picks from live options rather
 *                              than a stale checkout quote.
 *   bookBiteshipForOrder   -- creates the courier order for a chosen
 *                              service, writes its id back onto our row so
 *                              webhooks can find it, sets tracking, and
 *                              marks the order shipped.
 *
 * Every failure returns a shape the UI can render as words. The caller does
 * not decide how to phrase auth vs. balance vs. request errors -- that is
 * done here, once, alongside the classification.
 */

const TIMEOUT_MS = 8000;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function estimateDimensions(weightGrams: number) {
  if (weightGrams <= 300) return { length: 20, width: 12, height: 6 };
  if (weightGrams <= 1200) return { length: 25, width: 18, height: 10 };
  return { length: 35, width: 25, height: 20 };
}

interface OrderForBooking extends Order {
  order_items: OrderItem[];
}

/** Load the order, its items, and the variant weights that go with them. */
async function loadOrderWithWeights(
  supabase: SupabaseClient,
  orderId: string,
): Promise<{
  order: OrderForBooking | null;
  totalWeightGrams: number;
}> {
  const { data } = await supabase
    .from("orders")
    .select("*, order_items (*)")
    .eq("id", orderId)
    .maybeSingle();
  const order = data as OrderForBooking | null;
  if (!order) return { order: null, totalWeightGrams: 0 };

  const variantIds = order.order_items
    .map((i) => i.variant_id)
    .filter((v): v is string => Boolean(v));

  let totalWeightGrams = 0;
  if (variantIds.length) {
    const { data: variants } = await supabase
      .from("product_variants")
      .select("id, weight_grams")
      .in("id", variantIds);
    const weights = new Map<string, number>();
    for (const v of (variants ?? []) as { id: string; weight_grams: number }[]) {
      weights.set(v.id, Math.max(0, v.weight_grams));
    }
    for (const item of order.order_items) {
      const w = item.variant_id ? weights.get(item.variant_id) ?? 0 : 0;
      totalWeightGrams += w * item.quantity;
    }
  }

  // Floor: a courier cannot post a parcel weighing nothing. Matches
  // parcelWeight() in flat-zones so quotes stay consistent with checkout.
  if (totalWeightGrams <= 0) totalWeightGrams = 250;

  return { order, totalWeightGrams };
}

async function loadSettings(supabase: SupabaseClient): Promise<SiteSettings | null> {
  const { data } = await supabase
    .from("site_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  return (data as SiteSettings | null) ?? null;
}

// ---------------------------------------------------------------------------
// Precondition checks -- return a short reason string, or null if ok.
// ---------------------------------------------------------------------------

export interface OrderBookingContext {
  order: OrderForBooking;
  settings: SiteSettings;
  address: ShippingAddressSnapshot;
  totalWeightGrams: number;
}

export type BookingPrecheck =
  | { ok: true; context: OrderBookingContext }
  | { ok: false; reason: string };

async function precheck(
  supabase: SupabaseClient,
  orderId: string,
): Promise<BookingPrecheck> {
  const [{ order, totalWeightGrams }, settings] = await Promise.all([
    loadOrderWithWeights(supabase, orderId),
    loadSettings(supabase),
  ]);

  if (!order) return { ok: false, reason: "That order no longer exists." };
  if (order.voided_at) {
    return { ok: false, reason: "This order is voided -- put it back before booking a courier." };
  }
  if (!order.paid_at) {
    return { ok: false, reason: "Wait until the order is paid before booking a courier." };
  }
  if (order.courier_order_id) {
    return {
      ok: false,
      reason: `Already booked with Biteship (${order.courier_order_id}). Cancel it in the Biteship dashboard first if you need to rebook.`,
    };
  }

  const address = order.shipping_address;
  if (!address) {
    return { ok: false, reason: "This order has no shipping address -- add one before booking." };
  }
  const missing = [
    !address.recipient_name?.trim() && "recipient name",
    !address.phone?.trim() && "phone",
    !address.line1?.trim() && "street address",
    !address.city?.trim() && "city",
    !address.postal_code?.trim() && "postal code",
  ].filter(Boolean) as string[];
  if (missing.length) {
    return {
      ok: false,
      reason: `Delivery address is missing: ${missing.join(", ")}. Fill it in under "Correct the details".`,
    };
  }
  if ((address.country ?? "ID").trim().toUpperCase() !== "ID") {
    return {
      ok: false,
      reason: "Biteship books domestic Indonesian couriers only. Post international orders manually.",
    };
  }

  if (!settings) {
    return { ok: false, reason: "Site settings are missing -- cannot read pickup address." };
  }
  const originMissing = [
    !settings.origin_contact_name?.trim() && "contact name",
    !settings.origin_phone?.trim() && "phone",
    !settings.origin_address?.trim() && "address",
    !settings.origin_postal_code?.trim() && "postal code",
  ].filter(Boolean) as string[];
  if (originMissing.length) {
    return {
      ok: false,
      reason: `Pickup address is missing: ${originMissing.join(", ")}. Fill it in under Site settings -> Shipping -> Where you ship from.`,
    };
  }

  return {
    ok: true,
    context: { order, settings, address, totalWeightGrams },
  };
}

// ---------------------------------------------------------------------------
// Quote for booking -- reuses the rates endpoint against the real parcel.
// ---------------------------------------------------------------------------

export interface BookableOption extends BiteshipOption {
  /** Passed to bookBiteshipForOrder to identify the picked service. */
  courierCompany: string;
  courierService: string;
}

export type QuoteForBookingResult =
  | { ok: true; options: BookableOption[] }
  | { ok: false; reason: string };

export async function quoteBiteshipForOrder(
  supabase: SupabaseClient,
  orderId: string,
): Promise<QuoteForBookingResult> {
  const pre = await precheck(supabase, orderId);
  if (!pre.ok) return { ok: false, reason: pre.reason };
  const { settings, address, totalWeightGrams, order } = pre.context;

  const originPostal = Number(settings.origin_postal_code);
  const destinationPostal = Number(address.postal_code);
  const destinationArea = address.area_id?.trim() || null;
  if (!Number.isFinite(originPostal) || (!destinationArea && !Number.isFinite(destinationPostal))) {
    return {
      ok: false,
      reason: "Origin or destination postal code is not a number.",
    };
  }

  const body: BiteshipRateRequest = {
    origin_postal_code: originPostal,
    ...(destinationArea
      ? { destination_area_id: destinationArea }
      : { destination_postal_code: destinationPostal }),
    couriers: courierList(),
    items: [
      {
        name: "Coffee",
        description: `Order ${order.human_ref}`,
        value: Math.max(1, order.subtotal_idr),
        weight: totalWeightGrams,
        quantity: 1,
        ...estimateDimensions(totalWeightGrams),
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
      ok: false,
      reason: "Could not reach Biteship. Try again in a moment.",
    };
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, reason: "Biteship returned something unreadable." };
  }

  if (!response.ok) {
    const failure = classifyFailure(response.status, payload);
    return { ok: false, reason: explainFailure(failure) };
  }

  const all = parseRateOptions(payload);
  const usable = dropOffAllowed() ? all : all.filter(offersPickup);

  if (!usable.length) {
    return {
      ok: false,
      reason: all.length
        ? "Every courier for this route is drop-off only. Set BITESHIP_ALLOW_DROP_OFF=true if you can take parcels to a depot."
        : "No couriers serve this route. Try a different courier list, or post it another way.",
    };
  }

  const options: BookableOption[] = [];
  for (const o of usable) {
    // Booking needs the machine-readable codes, not just the display names.
    // An option that has no codes cannot be booked, so it is dropped -- the
    // rate itself is still available at checkout, just not through this
    // one-click booker.
    if (!o.courierCode || !o.serviceCode) continue;
    options.push({
      ...o,
      courierCompany: o.courierCode,
      courierService: o.serviceCode,
    });
  }

  if (!options.length) {
    return {
      ok: false,
      reason: "Biteship returned options but none carried a bookable service code.",
    };
  }

  // Cheapest first -- the same way checkout picks.
  options.sort((a, b) => a.priceIdr - b.priceIdr);
  return { ok: true, options };
}

// ---------------------------------------------------------------------------
// Book -- create the courier order and write its ids onto ours.
// ---------------------------------------------------------------------------

export interface BiteshipCreatedOrder {
  courierOrderId: string;
  waybillId: string | null;
  trackingId: string | null;
  status: string | null;
  priceIdr: number | null;
}

export type BookResult =
  | { ok: true; created: BiteshipCreatedOrder }
  | { ok: false; reason: string };

/**
 * Ask Biteship to create the courier order, then write its identifiers
 * onto ours. The webhook path handles later status/waybill updates -- this
 * only records what came back on the create call itself.
 *
 * On any failure the order is untouched, so the operator can retry without
 * cleaning up half-written state.
 */
export async function bookBiteshipForOrder(
  supabase: SupabaseClient,
  orderId: string,
  courierCompany: string,
  courierService: string,
): Promise<BookResult> {
  const pre = await precheck(supabase, orderId);
  if (!pre.ok) return { ok: false, reason: pre.reason };
  const { order, settings, address, totalWeightGrams } = pre.context;

  const originPostal = Number(settings.origin_postal_code);
  const destinationPostal = Number(address.postal_code);
  const destinationArea = address.area_id?.trim() || null;
  if (!Number.isFinite(originPostal)) {
    return { ok: false, reason: "Origin postal code is not a number." };
  }
  if (!destinationArea && !Number.isFinite(destinationPostal)) {
    return { ok: false, reason: "Destination postal code is not a number." };
  }

  const dimensions = estimateDimensions(totalWeightGrams);

  // Biteship's Create Order shape, corroborated from their public reference
  // and community wrappers. One aggregate item keeps the payload small and
  // matches how quotes were priced. Reference id is our order.id so a
  // webhook coming back with a wrong-header can still be reconciled.
  const body = {
    shipper_contact_name: settings.origin_contact_name ?? "",
    shipper_contact_phone: settings.origin_phone ?? "",
    shipper_contact_email: settings.contact_email ?? undefined,
    origin_contact_name: settings.origin_contact_name ?? "",
    origin_contact_phone: settings.origin_phone ?? "",
    origin_address: settings.origin_address ?? "",
    origin_note: settings.origin_note ?? undefined,
    origin_postal_code: originPostal,
    ...(settings.origin_area_code?.trim()
      ? { origin_area_id: settings.origin_area_code.trim() }
      : {}),
    destination_contact_name: address.recipient_name ?? "",
    destination_contact_phone: address.phone ?? "",
    destination_contact_email: address.email ?? undefined,
    destination_address: [address.line1, address.line2].filter(Boolean).join(", "),
    destination_note: order.courier_note ?? undefined,
    ...(destinationArea
      ? { destination_area_id: destinationArea }
      : { destination_postal_code: destinationPostal }),
    courier_company: courierCompany,
    courier_type: courierService,
    courier_insurance: 0,
    delivery_type: "now",
    reference_id: order.id,
    items: [
      {
        name: "Coffee",
        description: `Order ${order.human_ref}`,
        category: "food",
        value: Math.max(1, order.subtotal_idr),
        weight: totalWeightGrams,
        quantity: 1,
        ...dimensions,
      },
    ],
  } as const;

  let response: Response;
  try {
    response = await fetch(`${BITESHIP_API}/v1/orders`, {
      method: "POST",
      headers: { authorization: authHeader(), "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return { ok: false, reason: "Could not reach Biteship. Try again in a moment." };
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, reason: "Biteship returned something unreadable." };
  }

  if (!response.ok) {
    const failure = classifyFailure(response.status, payload);
    return { ok: false, reason: explainFailure(failure) };
  }

  const created = parseCreateResponse(payload);
  if (!created) {
    return {
      ok: false,
      reason: "Biteship accepted the request but did not return a courier order id.",
    };
  }

  // Write the identifiers back. Do NOT set status='shipped' or shipped_at
  // here -- physical despatch is a separate step and the courier's own
  // webhook (order.status = picked/on_delivery) will move it along
  // authoritatively. What we know for certain right now is: the booking
  // exists, and it has an id we can chase.
  const patch: Record<string, unknown> = {
    courier_order_id: created.courierOrderId,
  };
  if (created.waybillId) {
    patch.courier_waybill_id = created.waybillId;
    if (!order.tracking_number) patch.tracking_number = created.waybillId;
  }
  if (created.trackingId) patch.courier_tracking_id = created.trackingId;
  if (created.status) patch.courier_status = created.status;
  if (created.priceIdr !== null) patch.courier_charged_idr = created.priceIdr;
  patch.courier_company = courierCompany;
  patch.courier_type = courierService;

  const { error } = await supabase.from("orders").update(patch).eq("id", order.id);
  if (error) {
    // The courier order was created but we could not record it. Surface
    // both facts so the operator can reconcile by hand -- the id is the
    // only breadcrumb.
    return {
      ok: false,
      reason: `Biteship booked the shipment (id ${created.courierOrderId}) but the database refused the write: ${error.message}. Copy that id into the order manually.`,
    };
  }

  return { ok: true, created };
}

function parseCreateResponse(body: unknown): BiteshipCreatedOrder | null {
  const payload = body as Record<string, unknown> | null;
  if (!payload || typeof payload !== "object") return null;

  const courierOrderId =
    (typeof payload.id === "string" && payload.id) ||
    (typeof payload.order_id === "string" && payload.order_id) ||
    null;
  if (!courierOrderId) return null;

  const courier = (payload.courier as Record<string, unknown> | undefined) ?? undefined;
  const price = payload.price;

  const num = (v: unknown): number | null => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n) : null;
  };
  const str = (v: unknown): string | null =>
    typeof v === "string" && v.length > 0 ? v : null;

  return {
    courierOrderId,
    waybillId: str(courier?.waybill_id) ?? str(payload.courier_waybill_id),
    trackingId: str(courier?.tracking_id) ?? str(payload.courier_tracking_id),
    status: str(payload.status),
    priceIdr: num(price),
  };
}

function explainFailure(failure: {
  kind: "auth" | "balance" | "transient" | "request";
  code?: string;
  message: string;
}): string {
  switch (failure.kind) {
    case "auth":
      return `Biteship rejected the key (${failure.code || "auth error"}). Check BITESHIP_API_KEY, and that Order API is activated on the account.`;
    case "balance":
      return "Biteship is out of credit. Top up in the Biteship dashboard, then try again.";
    case "transient":
      return `Biteship is having a moment (${failure.message}). Try again shortly.`;
    case "request":
      return `Biteship refused the request: ${failure.message}`;
  }
}
