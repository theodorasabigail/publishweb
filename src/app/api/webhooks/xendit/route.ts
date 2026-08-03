import { NextResponse } from "next/server";
import { xenditProvider } from "@/lib/payments/xendit";
import {
  cancelOrder,
  findOrderByHumanRef,
  recordPaymentEvent,
  settleOrder,
} from "@/lib/payments/settle";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Xendit invoice callback (Path A).
 *
 * Point Xendit's "Invoices paid" webhook at:
 *   https://<your-domain>/api/webhooks/xendit
 *
 * Always answers 200 once the callback token checks out. Xendit retries on any
 * non-2xx, and retrying is pointless for a payload we have already stored.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const outcome = await xenditProvider.parseWebhook({
    body,
    headers: request.headers,
    rawBody,
  });

  // Xendit never produces a bare bank credit; this keeps the union narrowed.
  if (outcome.kind === "credit") {
    return NextResponse.json({ received: true, reason: "unexpected credit event" });
  }

  if (outcome.kind === "ignored") {
    // An invalid token is the one case worth rejecting outright.
    const status = outcome.reason === "invalid callback token" ? 401 : 200;
    return NextResponse.json({ received: true, reason: outcome.reason }, { status });
  }

  const supabase = createAdminClient();
  // Xendit echoes our human_ref back as external_id.
  const order = await findOrderByHumanRef(supabase, outcome.orderId);

  if (!order) {
    await recordPaymentEvent({
      provider: "xendit",
      externalId: outcome.kind === "paid" ? outcome.reference : outcome.orderId,
      amountIdr: null,
      status: outcome.kind,
      isMatched: false,
      payload: body,
    });
    return NextResponse.json({ received: true, matched: false });
  }

  if (outcome.kind === "failed") {
    await cancelOrder(supabase, order.id, `Payment ${outcome.reason}`);
    await recordPaymentEvent({
      provider: "xendit",
      externalId: `${order.human_ref}:${outcome.reason}`,
      amountIdr: order.total_idr,
      status: outcome.reason,
      matchedOrderId: order.id,
      isMatched: true,
      payload: body,
    });
    return NextResponse.json({ received: true, cancelled: true });
  }

  const result = await settleOrder(supabase, order.id, outcome.reference, outcome.method);

  await recordPaymentEvent({
    provider: "xendit",
    externalId: outcome.reference ?? order.human_ref,
    amountIdr: order.total_idr,
    status: result.ok ? "paid" : "settle_failed",
    matchedOrderId: order.id,
    isMatched: result.ok,
    payload: body,
  });

  if (!result.ok) {
    // Let Xendit retry -- the money is real and the order is still pending.
    return NextResponse.json({ error: "could not settle order" }, { status: 500 });
  }

  return NextResponse.json({ received: true, paid: true });
}
