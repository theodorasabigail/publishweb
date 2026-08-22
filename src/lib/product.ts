/**
 * Pure helpers for reading a product.
 *
 * Separate from queries.ts, and that separation is load-bearing: queries.ts
 * reaches for `next/headers` to build a Supabase client, so anything importing
 * from it is server-only. ProductCard needs `lowestPrice`, and ProductCard is
 * rendered inside the client-side shop browser — importing these from queries
 * dragged the database client into the browser bundle and failed the build.
 *
 * Nothing here touches the network, cookies or the database. That is the rule
 * for this file.
 */

import type { ProductWithVariants } from "@/lib/types";

/** Cheapest size on sale, or null when nothing is priced. */
export function lowestPrice(product: ProductWithVariants): number | null {
  const prices = (product.product_variants ?? []).map((v) => v.price_idr);
  return prices.length ? Math.min(...prices) : null;
}

/**
 * How many bags of this coffee may still be sold.
 *
 * Reads `available` rather than `stock`, so a bag an unpaid WhatsApp order is
 * holding does not get offered to a second customer on the website.
 */
export function totalStock(product: ProductWithVariants): number {
  return (product.product_variants ?? []).reduce((sum, v) => sum + v.available, 0);
}

/**
 * Smallest pack first, whatever order Postgres returns them in.
 *
 * Ordered by weight rather than by a list of known size names. That is what
 * lets the operator invent a size: a new 250g bag sorts between 200g and 1kg
 * because it weighs what it weighs, with nobody maintaining an order. Ties
 * fall back to the label so the result is at least stable.
 */
export function sortVariants(
  products: ProductWithVariants[],
): ProductWithVariants[] {
  return products.map((product) => ({
    ...product,
    product_variants: [...(product.product_variants ?? [])]
      .filter((variant) => variant.is_active)
      .sort(
        (a, b) =>
          a.weight_grams - b.weight_grams || a.size.localeCompare(b.size),
      ),
  }));
}
