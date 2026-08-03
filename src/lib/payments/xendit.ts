import { env } from "@/lib/env";
import type {
  PaymentIntent,
  PaymentProvider,
  ResolvedTotal,
  WebhookOutcome,
} from "./types";

/**
 * Path A -- Xendit (spec §8, primary).
 *
 * Uses the Invoice API, which gives every payment channel the shop needs from
 * one call: dynamic QRIS with the amount pre-filled, virtual accounts and
 * e-wallets for domestic customers, and cards for foreign ones.
 *
 * Setup, all from the Xendit dashboard, no code:
 *   1. Settings → API Keys → create a secret key   → XENDIT_SECRET_KEY
 *   2. Settings → Webhooks → set the "Invoices paid" callback URL to
 *      https://<your-domain>/api/webhooks/xendit
 *   3. Copy the webhook verification token          → XENDIT_WEBHOOK_TOKEN
 */

const XENDIT_API = "https://api.xendit.co";
const INVOICE_DURATION_SECONDS = 60 * 60 * 24; // 24 hours

function authHeader(): string {
  const key = env.optional("XENDIT_SECRET_KEY");
  if (!key) {
    throw new Error(
      "Missing XENDIT_SECRET_KEY. Add it in Vercel → Settings → Environment Variables, or set PAYMENT_PROVIDER=manual_transfer to use the bank-transfer fallback.",
    );
  }
  return `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
}

interface XenditInvoiceResponse {
  id: string;
  invoice_url: string;
  expiry_date?: string;
  status?: string;
}

export const xenditProvider: PaymentProvider = {
  id: "xendit",
  label: "Card, QRIS, virtual account & e-wallet",
  supportsInternationalCards: true,
  isManual: false,

  async resolveTotal(subtotalIdr, shippingIdr): Promise<ResolvedTotal> {
    // The gateway confirms the exact amount itself, so no unique code is needed.
    return { uniqueCode: 0, totalIdr: subtotalIdr + shippingIdr };
  },

  async createIntent({ order, customer, successUrl, failureUrl }): Promise<PaymentIntent> {
    const response = await fetch(`${XENDIT_API}/v2/invoices`, {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Xendit requires this to be unique; the human ref already is.
        external_id: order.humanRef,
        amount: order.totalIdr,
        currency: "IDR",
        description: `Publish Coffee Roasters — ${order.humanRef}`,
        invoice_duration: INVOICE_DURATION_SECONDS,
        payer_email: customer.email,
        customer: {
          given_names: customer.name,
          email: customer.email,
          mobile_number: customer.phone ?? undefined,
        },
        success_redirect_url: successUrl,
        failure_redirect_url: failureUrl,
        items: [
          {
            name: `Order ${order.humanRef}`,
            quantity: 1,
            price: order.subtotalIdr,
            category: "Coffee",
          },
        ],
        fees:
          order.shippingIdr > 0
            ? [{ type: "Shipping", value: order.shippingIdr }]
            : undefined,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Xendit invoice creation failed (${response.status}): ${detail}`);
    }

    const invoice = (await response.json()) as XenditInvoiceResponse;

    return {
      provider: "xendit",
      reference: invoice.id,
      redirectUrl: invoice.invoice_url,
      expiresAt: invoice.expiry_date,
    };
  },

  async parseWebhook({ body, headers }): Promise<WebhookOutcome> {
    const expectedToken = env.optional("XENDIT_WEBHOOK_TOKEN");
    if (!expectedToken) {
      return { kind: "ignored", reason: "XENDIT_WEBHOOK_TOKEN is not configured" };
    }

    const token = headers.get("x-callback-token");
    if (token !== expectedToken) {
      return { kind: "ignored", reason: "invalid callback token" };
    }

    const payload = body as {
      id?: string;
      external_id?: string;
      status?: string;
      payment_method?: string;
      payment_channel?: string;
    };

    const externalId = payload.external_id;
    if (!externalId) {
      return { kind: "ignored", reason: "callback has no external_id" };
    }

    const status = (payload.status ?? "").toUpperCase();
    const method = payload.payment_channel ?? payload.payment_method ?? null;

    // `external_id` is our human_ref; the route resolves it to the order id.
    if (status === "PAID" || status === "SETTLED") {
      return {
        kind: "paid",
        orderId: externalId,
        reference: payload.id ?? null,
        method,
      };
    }

    if (status === "EXPIRED" || status === "FAILED") {
      return { kind: "failed", orderId: externalId, reason: status.toLowerCase() };
    }

    return { kind: "ignored", reason: `unhandled status ${status || "(none)"}` };
  },
};
