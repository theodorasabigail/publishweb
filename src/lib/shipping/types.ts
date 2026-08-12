/**
 * Shipping provider contract.
 *
 * v1 is flat-rate zones held in the database. The spec's v2 is Biteship live
 * rates. Everything above this file — checkout, the quote API, the order
 * record — talks to this interface only, so adding a live-rate provider is a
 * new implementation rather than a rewrite.
 *
 * `quote` is async on purpose. Flat zones answer instantly from a table, but a
 * live-rate provider is an HTTP call with a secret key, which can only happen
 * server-side. Making the contract async from the start means the client
 * already fetches its quote from our own API and nothing about that has to
 * change later.
 */

export interface ShippingDestination {
  country: string;
  province?: string | null;
  city?: string | null;
  postalCode?: string | null;
}

export interface ShippingParcel {
  weightGrams: number;
  /** Order subtotal, which is what spend-based subsidies are measured against. */
  subtotalIdr: number;
}

export interface ShippingQuote {
  zoneCode: string;
  zoneName: string;
  /** The undiscounted rate. */
  fullRateIdr: number;
  /** What the roastery absorbs. Never exceeds fullRateIdr. */
  discountIdr: number;
  /** What the customer pays: fullRateIdr - discountIdr. */
  amountIdr: number;
  isFree: boolean;
  estimate: string | null;
  /** Set when a discount applied, for a line the customer can read. */
  discountLabel: string | null;
}

export interface ShippingProvider {
  readonly id: string;
  readonly label: string;
  /** Whether rates come from a live carrier lookup. Drives whether checkout
   *  shows "estimated" wording. */
  readonly isLiveRate: boolean;

  quote(
    destination: ShippingDestination,
    parcel: ShippingParcel,
  ): Promise<ShippingQuote | null>;
}
