import { NextResponse } from "next/server";
import { manualTransferProvider } from "@/lib/payments/manual-transfer";
import {
  findPendingOrderByAmount,
  recordPaymentEvent,
  settleOrder,
} from "@/lib/payments/settle";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Moota bank-mutation webhook (Path B).
 *
 * Point Moota's webhook at:
 *   https://<your-domain>/api/webhooks/moota
 *
 * Moota posts an array of mutations. Each incoming credit is matched to the
 * single pending order carrying that exact rupiah total (base + unique code).
 * Anything that fails to match is stored as an unresolved payment event and
 * shows up in Admin → Payments, so a mis-typed static-QRIS amount is a queue
 * item rather than a lost order.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const mutations = Array.isArray(body) ? body : [body];
  const supabase = createAdminClient();
  const results: Array<{ amount: number; matched: boolean }> = [];

  for (const mutation of mutations) {
    const outcome = await manualTransferProvider.parseWebhook({
      body: mutation,
      headers: request.headers,
      // Moota signs the whole request body, not each mutation.
      rawBody,
    });

    if (outcome.kind === "ignored") {
      if (outcome.reason === "invalid webhook signature") {
        return NextResponse.json({ error: outcome.reason }, { status: 401 });
      }
      continue;
    }

    if (outcome.kind !== "credit") continue;

    const order = await findPendingOrderByAmount(supabase, outcome.amountIdr);

    if (!order) {
      await recordPaymentEvent({
        provider: "moota",
        externalId: outcome.reference,
        amountIdr: outcome.amountIdr,
        status: "unmatched",
        isMatched: false,
        payload: mutation,
      });
      results.push({ amount: outcome.amountIdr, matched: false });
      continue;
    }

    const result = await settleOrder(
      supabase,
      order.id,
      outcome.reference,
      "bank_transfer",
    );

    await recordPaymentEvent({
      provider: "moota",
      externalId: outcome.reference,
      amountIdr: outcome.amountIdr,
      status: result.ok ? "paid" : "settle_failed",
      matchedOrderId: order.id,
      isMatched: result.ok,
      payload: mutation,
    });

    results.push({ amount: outcome.amountIdr, matched: result.ok });
  }

  return NextResponse.json({ received: true, results });
}
