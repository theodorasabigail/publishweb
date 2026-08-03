import type { VariantSize } from "@/lib/types";

/**
 * Cart shape shared by the client store and the checkout API.
 *
 * Prices are carried here only so the cart can render without a round-trip.
 * They are never trusted: /api/checkout re-reads every variant from the
 * database and prices the order from that.
 */
export interface CartLine {
  productId: string;
  variantId: string;
  slug: string;
  name: string;
  size: VariantSize;
  priceIdr: number;
  weightGrams: number;
  imageUrl: string | null;
  accentColor: string;
  quantity: number;
}

export const CART_STORAGE_KEY = "publish-cart-v1";
export const MAX_LINE_QUANTITY = 99;

export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.priceIdr * line.quantity, 0);
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function addLine(lines: CartLine[], incoming: CartLine): CartLine[] {
  const existing = lines.find((line) => line.variantId === incoming.variantId);
  if (!existing) return [...lines, incoming];

  return lines.map((line) =>
    line.variantId === incoming.variantId
      ? {
          ...line,
          quantity: Math.min(MAX_LINE_QUANTITY, line.quantity + incoming.quantity),
        }
      : line,
  );
}

export function setLineQuantity(
  lines: CartLine[],
  variantId: string,
  quantity: number,
): CartLine[] {
  if (quantity <= 0) return lines.filter((line) => line.variantId !== variantId);
  return lines.map((line) =>
    line.variantId === variantId
      ? { ...line, quantity: Math.min(MAX_LINE_QUANTITY, quantity) }
      : line,
  );
}

/** Narrow unknown localStorage contents back to a cart, dropping anything that
 *  no longer looks like a line. */
export function parseStoredCart(raw: string | null): CartLine[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((line): line is CartLine => {
      const candidate = line as Partial<CartLine>;
      return (
        typeof candidate?.variantId === "string" &&
        typeof candidate?.productId === "string" &&
        typeof candidate?.quantity === "number" &&
        candidate.quantity > 0
      );
    });
  } catch {
    return [];
  }
}
