import type { ShippingZone } from "@/lib/types";
import { formatIDR } from "@/lib/utils";

/**
 * Spend-based shipping discounts.
 *
 * Deliberately separate from any one provider. The zone decides the *discount
 * policy* — free over a spend, or a fixed amount off over a lower spend — while
 * the provider decides the *base rate*. That split means a live-rate courier
 * API gets the same discounts as flat zones without either knowing about the
 * other, which was the loose end flagged in docs/SHIPPING.md.
 */

export interface AppliedDiscount {
  /** What the roastery absorbs. Never exceeds the rate it was applied to. */
  discountIdr: number;
  /** A line the customer can read, or null when nothing applied. */
  discountLabel: string | null;
}

export function applySpendDiscount(
  fullRateIdr: number,
  subtotalIdr: number,
  zone: Pick<ShippingZone, "free_shipping_over_idr" | "subsidy_over_idr" | "subsidy_idr">,
): AppliedDiscount {
  // Most generous tier first, so someone clearing the free threshold is never
  // charged the smaller subsidy instead.
  if (zone.free_shipping_over_idr !== null && subtotalIdr >= zone.free_shipping_over_idr) {
    return {
      discountIdr: fullRateIdr,
      discountLabel: `Free shipping over ${formatIDR(zone.free_shipping_over_idr)}`,
    };
  }

  if (
    zone.subsidy_over_idr !== null &&
    zone.subsidy_idr > 0 &&
    subtotalIdr >= zone.subsidy_over_idr
  ) {
    // Capped at the rate: a subsidy may zero shipping out, never turn into a
    // discount on the coffee itself.
    const discountIdr = Math.min(zone.subsidy_idr, fullRateIdr);
    return {
      discountIdr,
      discountLabel: `${formatIDR(discountIdr)} off shipping over ${formatIDR(zone.subsidy_over_idr)}`,
    };
  }

  return { discountIdr: 0, discountLabel: null };
}
