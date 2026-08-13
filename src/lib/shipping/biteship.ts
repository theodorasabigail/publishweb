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

export const BITESHIP_API = "https://api.biteship.com";

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
  /** Timeout, 5xx, network. Fall back quietly and carry on. */
  | { kind: "transient"; message: string }
  /** A request we built wrong. Worth logging loudly in development. */
  | { kind: "request"; code: string; message: string };

export function classifyFailure(status: number, body: unknown): BiteshipFailure {
  const payload = body as { code?: number | string; error?: string; message?: string } | null;
  const code = payload?.code !== undefined ? String(payload.code) : "";
  const message = payload?.error ?? payload?.message ?? `HTTP ${status}`;

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
const DELIVERED_STATUSES = new Set(["delivered"]);

export function orderStatusFor(courierStatus: string | null): "shipped" | "completed" | null {
  if (!courierStatus) return null;
  const normalised = courierStatus.trim().toLowerCase();
  if (DELIVERED_STATUSES.has(normalised)) return "completed";
  if (SHIPPED_STATUSES.has(normalised)) return "shipped";
  return null;
}
