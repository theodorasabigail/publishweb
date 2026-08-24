import { NextResponse } from "next/server";
import { z } from "zod";
import { getShippingProvider, parcelWeight } from "@/lib/shipping";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ProductVariant } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Quote shipping for a cart and destination.
 *
 * Checkout calls this rather than pricing shipping in the browser. That costs
 * a round-trip, and buys two things: the quote comes from the same code that
 * prices the real order, and a live-rate provider — which needs a secret key
 * and so can only run server-side — can be dropped in without touching the
 * checkout form.
 *
 * Weight and subtotal are recomputed from the database. The client sends only
 * variant ids and quantities, so a tampered cart cannot buy cheaper shipping.
 */
const schema = z.object({
  country: z.string().min(2).max(20),
  province: z.string().max(120).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  postalCode: z.string().max(20).optional().nullable(),
  areaId: z.string().max(120).optional().nullable(),
  items: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        quantity: z.number().int().min(1).max(99),
      }),
    )
    .min(1)
    .max(40),
});

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { country, province, city, postalCode, areaId, items } = parsed.data;
  const supabase = createAdminClient();

  const { data: variantRows, error } = await supabase
    .from("product_variants")
    .select("id, price_idr, weight_grams")
    .in("id", [...new Set(items.map((item) => item.variantId))]);

  if (error) {
    return NextResponse.json({ error: "Could not price shipping." }, { status: 500 });
  }

  const variants = (variantRows ?? []) as Pick<
    ProductVariant,
    "id" | "price_idr" | "weight_grams"
  >[];

  let subtotalIdr = 0;
  const parcelItems: { weightGrams: number; quantity: number }[] = [];

  for (const item of items) {
    const variant = variants.find((row) => row.id === item.variantId);
    // Silently skip anything that has since disappeared — /api/checkout is
    // where an unavailable item becomes a hard error, not here.
    if (!variant) continue;
    subtotalIdr += variant.price_idr * item.quantity;
    parcelItems.push({ weightGrams: variant.weight_grams, quantity: item.quantity });
  }

  if (!parcelItems.length) {
    return NextResponse.json({ error: "Nothing in the cart is available." }, { status: 409 });
  }

  const provider = getShippingProvider(supabase);
  const quote = await provider.quote(
    { country, province, city, postalCode, areaId },
    { weightGrams: parcelWeight(parcelItems), subtotalIdr },
  );

  if (!quote) {
    return NextResponse.json(
      {
        error:
          "We do not have a shipping rate for that destination yet. Message us and we will sort it out.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json({ quote, isLiveRate: provider.isLiveRate });
}
