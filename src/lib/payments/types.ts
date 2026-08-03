/**
 * Payment provider contract.
 *
 * Spec §8 leaves the payment path open: Xendit (Path A) is primary, static
 * QRIS + kode unik + Moota (Path B) is the domestic-only fallback. Everything
 * above this file is written against this interface only, so switching paths
 * is an environment variable change plus a webhook URL -- not a rewrite.
 */

export interface PaymentCustomer {
  name: string;
  email: string;
  phone?: string | null;
}

export interface PaymentOrderSummary {
  id: string;
  humanRef: string;
  subtotalIdr: number;
  shippingIdr: number;
  uniqueCode: number;
  totalIdr: number;
}

/** Manual payment instructions, shown on the order page for providers that
 *  cannot hand off to a hosted checkout. */
export interface ManualPaymentInstructions {
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  qrisImageUrl?: string;
  /** The exact rupiah amount the customer must transfer, unique code included. */
  exactAmountIdr: number;
  note: string;
}

export interface PaymentIntent {
  provider: string;
  /** Provider-side identifier stored on the order as `payment_ref`. */
  reference: string;
  /** Hosted checkout to redirect to, when the provider has one. */
  redirectUrl?: string;
  instructions?: ManualPaymentInstructions;
  expiresAt?: string;
  method?: string;
}

/** Result of turning a cart total into a payable total. Path B adds a unique
 *  3-digit code here; Path A leaves the total untouched. */
export interface ResolvedTotal {
  uniqueCode: number;
  totalIdr: number;
}

export type WebhookOutcome =
  | { kind: "ignored"; reason: string }
  | { kind: "paid"; orderId: string; reference: string | null; method: string | null }
  | { kind: "failed"; orderId: string; reason: string }
  /** Path B: an incoming bank credit that must be reconciled by exact amount. */
  | {
      kind: "credit";
      amountIdr: number;
      reference: string | null;
      description: string | null;
    };

export interface PaymentProvider {
  readonly id: string;
  readonly label: string;
  /** Whether foreign customers can pay with a card through this provider. */
  readonly supportsInternationalCards: boolean;
  /** Whether checkout must show manual transfer instructions instead of a
   *  redirect. Drives the confirmation page's UI. */
  readonly isManual: boolean;

  /**
   * Decide the final payable amount. Called before the order row is written.
   * `isAmountTaken` lets a unique-code provider avoid colliding with another
   * pending order for the same rupiah amount.
   */
  resolveTotal(
    subtotalIdr: number,
    shippingIdr: number,
    isAmountTaken: (amount: number) => Promise<boolean>,
  ): Promise<ResolvedTotal>;

  /** Create the payment. Runs after the order row exists, so the human ref can
   *  be used as the provider-side external id. */
  createIntent(input: {
    order: PaymentOrderSummary;
    customer: PaymentCustomer;
    successUrl: string;
    failureUrl: string;
  }): Promise<PaymentIntent>;

  /** Normalise an inbound webhook. Signature/token verification happens here;
   *  returning `ignored` for an unverified call is the provider's job. */
  parseWebhook(input: {
    body: unknown;
    headers: Headers;
    rawBody: string;
  }): Promise<WebhookOutcome>;
}
