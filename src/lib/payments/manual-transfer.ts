import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import type {
  PaymentIntent,
  PaymentProvider,
  ResolvedTotal,
  WebhookOutcome,
} from "./types";

/**
 * Path B -- static QRIS + kode unik + Moota (spec §8, domestic-only fallback).
 *
 * Every pending order gets a unique 3-digit code added to its total, so
 * Rp 165.000 becomes Rp 165.247. Moota watches the shop's bank account and
 * posts each incoming credit to /api/webhooks/moota, where the amount is
 * matched back to the order. Nothing about this is manual at the operator's
 * end -- an amount that fails to match lands in the admin's unmatched-payments
 * queue rather than being silently dropped.
 *
 * Accepted limitations, per the spec: no foreign cards, a small monthly Moota
 * fee, and mis-typed static-QR amounts that need resolving in the queue.
 */

const UNIQUE_CODE_MIN = 100;
const UNIQUE_CODE_MAX = 999;
const MAX_CODE_ATTEMPTS = 40;

export const manualTransferProvider: PaymentProvider = {
  id: "manual_transfer",
  label: "Bank transfer / QRIS (unique amount)",
  supportsInternationalCards: false,
  isManual: true,

  async resolveTotal(subtotalIdr, shippingIdr, isAmountTaken): Promise<ResolvedTotal> {
    const base = subtotalIdr + shippingIdr;

    // Reconciliation is by exact amount, so two pending orders must never share
    // one. Try random codes, then fall back to a linear scan.
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const code =
        UNIQUE_CODE_MIN +
        Math.floor(Math.random() * (UNIQUE_CODE_MAX - UNIQUE_CODE_MIN + 1));
      if (!(await isAmountTaken(base + code))) {
        return { uniqueCode: code, totalIdr: base + code };
      }
    }

    for (let code = UNIQUE_CODE_MIN; code <= UNIQUE_CODE_MAX; code++) {
      if (!(await isAmountTaken(base + code))) {
        return { uniqueCode: code, totalIdr: base + code };
      }
    }

    throw new Error(
      "Could not allocate a unique payment amount — too many pending orders at this total. Try again in a few minutes.",
    );
  },

  async createIntent({ order }): Promise<PaymentIntent> {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    return {
      provider: "manual_transfer",
      reference: order.humanRef,
      expiresAt,
      method: "bank_transfer",
      instructions: {
        bankName: env.optional("MANUAL_TRANSFER_BANK_NAME"),
        accountNumber: env.optional("MANUAL_TRANSFER_ACCOUNT_NUMBER"),
        accountName: env.optional("MANUAL_TRANSFER_ACCOUNT_NAME"),
        qrisImageUrl: env.optional("MANUAL_TRANSFER_QRIS_IMAGE_URL"),
        exactAmountIdr: order.totalIdr,
        note: `Transfer the exact amount, including the last three digits (${String(
          order.uniqueCode,
        ).padStart(3, "0")}). That is how we recognise your payment automatically.`,
      },
    };
  },

  async parseWebhook({ body, headers, rawBody }): Promise<WebhookOutcome> {
    const secret = env.optional("MOOTA_WEBHOOK_SECRET");
    if (!secret) {
      return { kind: "ignored", reason: "MOOTA_WEBHOOK_SECRET is not configured" };
    }

    const signature = headers.get("signature") ?? headers.get("x-signature");
    if (!signature || !verifySignature(rawBody, signature, secret)) {
      return { kind: "ignored", reason: "invalid webhook signature" };
    }

    // Moota posts an array of mutations; the route replays them one at a time,
    // so handle both an array of one and a bare object.
    const entry = Array.isArray(body) ? body[0] : body;
    const mutation = entry as {
      mutation_id?: string;
      bank_id?: string;
      amount?: number | string;
      type?: string;
      description?: string;
      note?: string;
    };

    if (!mutation || typeof mutation !== "object") {
      return { kind: "ignored", reason: "unrecognised payload" };
    }

    // Only money coming in can settle an order.
    if (mutation.type && mutation.type.toUpperCase() !== "CR") {
      return { kind: "ignored", reason: `ignoring ${mutation.type} mutation` };
    }

    const amount = Number(mutation.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { kind: "ignored", reason: "mutation has no usable amount" };
    }

    return {
      kind: "credit",
      amountIdr: Math.round(amount),
      reference: mutation.mutation_id ?? null,
      description: mutation.description ?? mutation.note ?? null,
    };
  },
};

function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature.trim());
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Exposed for the checkout page so it can render the same numbers the
 *  instructions will use, before an order exists. */
export function manualTransferDetails() {
  return {
    bankName: env.optional("MANUAL_TRANSFER_BANK_NAME"),
    accountNumber: env.optional("MANUAL_TRANSFER_ACCOUNT_NUMBER"),
    accountName: env.optional("MANUAL_TRANSFER_ACCOUNT_NAME"),
    qrisImageUrl: env.optional("MANUAL_TRANSFER_QRIS_IMAGE_URL"),
  };
}
