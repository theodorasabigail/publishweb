import { NextResponse } from "next/server";
import {
  orderStatusFor,
  parseWebhook,
  verifyWebhookSecret,
} from "@/lib/shipping/biteship";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Order } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Biteship courier webhooks: order.status, order.price, order.waybill_id.
 *
 * Configure in the Biteship dashboard as:
 *   https://your-domain.com/api/webhooks/biteship?token=<BITESHIP_WEBHOOK_SECRET>
 *
 * Three rules shape what this does:
 *
 * 1. It always returns 200 OK, on any request shape. Biteship validates the
 *    webhook URL at install time with a bare ping -- no token, no body, or
 *    a GET -- and refuses to save the webhook unless the URL returns OK.
 *    Returning 401/400 on those pings blocked installation. Real events are
 *    still filtered by token + payload before anything is written.
 * 2. Everything actionable is logged to `courier_events` before anything is
 *    acted on, so an unexpected payload is inspectable rather than lost.
 * 3. It never rewrites what the customer paid. A courier charging more than
 *    we quoted is recorded alongside, not instead of, `shipping_idr` -- the
 *    money the customer agreed to is settled and stays settled.
 */

/** Biteship's install-time validation. Some validators use GET rather than
 *  POST; both need to succeed. Returning a plain OK is enough -- the body is
 *  not inspected. */
export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const url = new URL(request.url);

  // Read the body first. An install ping is either empty or non-JSON; both
  // are OK. Any read failure is treated the same way -- we never want a
  // handshake to fail because of body handling.
  let raw: string | null = null;
  try {
    raw = await request.text();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const trimmed = raw?.trim() ?? "";
  if (!trimmed) {
    // Empty body: install validation ping from Biteship. OK with no work.
    return NextResponse.json({ ok: true });
  }

  let body: unknown;
  try {
    body = JSON.parse(trimmed);
  } catch {
    // Non-JSON body: also treated as a ping. Real Biteship events are JSON.
    return NextResponse.json({ ok: true });
  }

  // Real event handling starts here. Only *now* do we require the shared
  // secret -- an install ping without one still succeeded above, so the URL
  // can be saved on the Biteship dashboard, and every subsequent event is
  // filtered by the ?token= check.
  if (!verifyWebhookSecret(url)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const parsed = parseWebhook(body);
  const supabase = createAdminClient();

  if (parsed.event === "unknown") {
    // Log it and accept: an event type we do not handle yet is not an error,
    // and returning non-2xx would make Biteship retry it forever.
    await supabase.from("courier_events").insert({
      event: "unknown",
      payload: body as never,
      is_matched: false,
    });
    return NextResponse.json({ received: true, handled: false });
  }

  const { data: orderRow } = await supabase
    .from("orders")
    .select("*")
    .eq("courier_order_id", parsed.courierOrderId)
    .maybeSingle();

  const order = orderRow as Order | null;

  await supabase.from("courier_events").insert({
    event: parsed.event,
    courier_order_id: parsed.courierOrderId,
    order_id: order?.id ?? null,
    status: parsed.status,
    payload: body as never,
    is_matched: Boolean(order),
  });

  if (!order) {
    // Accept it — retrying will not make an unknown order appear, and the
    // event is now visible in the admin as unmatched.
    return NextResponse.json({ received: true, matched: false });
  }

  const update: Record<string, unknown> = {};

  if (parsed.status) update.courier_status = parsed.status;

  if (parsed.event === "order.status") {
    if (parsed.waybillId) update.courier_waybill_id = parsed.waybillId;
    if (parsed.trackingId) update.courier_tracking_id = parsed.trackingId;
    if (parsed.company) update.courier_company = parsed.company;
    if (parsed.type) update.courier_type = parsed.type;
    if (parsed.driverName) update.courier_driver_name = parsed.driverName;
    if (parsed.driverPhone) update.courier_driver_phone = parsed.driverPhone;

    // Surface the waybill as the customer-facing tracking number, so nobody
    // has to copy it across by hand.
    if (parsed.waybillId && !order.tracking_number) {
      update.tracking_number = parsed.waybillId;
    }

    // Move our own status along, but never backwards, and never off a
    // cancelled order.
    const next = orderStatusFor(parsed.status);
    if (next && order.status !== "cancelled") {
      const rank: Record<string, number> = {
        pending: 0, paid: 1, roasting: 2, shipped: 3, cancelled: 9,
      };
      if ((rank[next] ?? 0) > (rank[order.status] ?? 0)) {
        update.status = next;
      }
    }
  }

  if (parsed.event === "order.waybill_id") {
    if (parsed.waybillId) update.courier_waybill_id = parsed.waybillId;
    if (parsed.trackingId) update.courier_tracking_id = parsed.trackingId;
    // The waybill can change when a parcel switches courier mid-route, so this
    // one does overwrite the customer-facing number.
    if (parsed.waybillId) update.tracking_number = parsed.waybillId;
  }

  if (parsed.event === "order.price") {
    if (parsed.waybillId) update.courier_waybill_id = parsed.waybillId;
    // Recorded, never applied. What the customer paid is not revisited; the
    // difference is the roastery's, and shows up in the admin's variance
    // report if it is large enough to matter.
    if (parsed.priceIdr !== null) update.courier_charged_idr = parsed.priceIdr;
  }

  if (Object.keys(update).length > 0) {
    await supabase.from("orders").update(update).eq("id", order.id);
  }

  return NextResponse.json({ received: true, matched: true });
}
