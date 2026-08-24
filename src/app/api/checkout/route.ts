import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { siteUrl } from "@/lib/env";
import { getPaymentProvider } from "@/lib/payments";
import { getShippingProvider, parcelWeight } from "@/lib/shipping";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ProductVariant } from "@/lib/types";

export const runtime = "nodejs";

const addressSchema = z.object({
  recipient_name: z.string().min(1).max(120),
  phone: z.string().min(5).max(40),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional().nullable(),
  // Kelurahan and kecamatan. Optional because an address outside Indonesia has
  // neither, and one saved before the area lookup existed has neither either.
  village: z.string().max(120).optional().nullable(),
  district: z.string().max(120).optional().nullable(),
  city: z.string().min(1).max(120),
  province: z.string().max(120).optional().nullable(),
  postal_code: z.string().max(20).optional().nullable(),
  country: z.string().min(2).max(20),
  area_id: z.string().max(120).optional().nullable(),
});

const checkoutSchema = z.object({
  email: z.string().email(),
  note: z.string().max(1000).optional(),
  saveAddress: z.boolean().optional(),
  address: addressSchema,
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
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = checkoutSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the form — some details are missing or invalid." },
      { status: 400 },
    );
  }

  const { email, note, address, items, saveAddress } = parsed.data;
  const supabase = createAdminClient();
  const session = await getSession();

  // -----------------------------------------------------------------------
  // Price the order from the database, never from the client's cart payload.
  // -----------------------------------------------------------------------
  const variantIds = [...new Set(items.map((item) => item.variantId))];
  const { data: variantRows, error: variantError } = await supabase
    .from("product_variants")
    .select("*, products ( id, name, slug, is_active )")
    .in("id", variantIds);

  if (variantError) {
    return NextResponse.json(
      { error: "Could not load the products in your cart. Please try again." },
      { status: 500 },
    );
  }

  type VariantRow = ProductVariant & {
    products: { id: string; name: string; slug: string; is_active: boolean } | null;
  };
  const variants = (variantRows ?? []) as VariantRow[];

  const lines = [];
  for (const item of items) {
    const variant = variants.find((row) => row.id === item.variantId);
    if (!variant || !variant.is_active || !variant.products?.is_active) {
      return NextResponse.json(
        { error: "One of the coffees in your cart is no longer available." },
        { status: 409 },
      );
    }
    // `available`, not `stock`: coffee an unpaid manual order is holding is
    // not ours to sell twice.
    if (variant.available < item.quantity) {
      return NextResponse.json(
        {
          error: `Only ${variant.available} × ${variant.products.name} (${variant.size}) left in stock.`,
        },
        { status: 409 },
      );
    }

    lines.push({
      variant,
      quantity: item.quantity,
      lineTotal: variant.price_idr * item.quantity,
    });
  }

  const subtotalIdr = lines.reduce((sum, line) => sum + line.lineTotal, 0);

  // -----------------------------------------------------------------------
  // Shipping
  // -----------------------------------------------------------------------
  // Same provider the quote endpoint uses, so the price shown at checkout and
  // the price charged come from one implementation.
  const weight = parcelWeight(
    lines.map((line) => ({
      weightGrams: line.variant.weight_grams,
      quantity: line.quantity,
    })),
  );

  const shippingQuote = await getShippingProvider(supabase).quote(
    {
      country: address.country,
      province: address.province,
      city: address.city,
      postalCode: address.postal_code,
      areaId: address.area_id,
    },
    { weightGrams: weight, subtotalIdr },
  );

  if (!shippingQuote) {
    return NextResponse.json(
      { error: "We do not have a shipping rate for that destination yet. Message us and we will sort it out." },
      { status: 400 },
    );
  }

  // -----------------------------------------------------------------------
  // Payment total. A unique-code provider needs an amount no other pending
  // order is already using.
  // -----------------------------------------------------------------------
  const provider = getPaymentProvider();

  async function isAmountTaken(amount: number): Promise<boolean> {
    const { count } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .eq("total_idr", amount);
    return (count ?? 0) > 0;
  }

  let resolvedTotal;
  try {
    resolvedTotal = await provider.resolveTotal(
      subtotalIdr,
      shippingQuote.amountIdr,
      isAmountTaken,
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not price the order." },
      { status: 500 },
    );
  }

  // -----------------------------------------------------------------------
  // Create the order
  // -----------------------------------------------------------------------
  const { data: orderRow, error: orderError } = await supabase
    .from("orders")
    .insert({
      user_id: session?.userId ?? null,
      guest_email: session ? null : email,
      status: "pending",
      subtotal_idr: subtotalIdr,
      shipping_idr: shippingQuote.amountIdr,
      shipping_discount_idr: shippingQuote.discountIdr,
      unique_code: resolvedTotal.uniqueCode,
      total_idr: resolvedTotal.totalIdr,
      payment_method: provider.id,
      shipping_zone: shippingQuote.zoneCode,
      shipping_address: { ...address, email },
      customer_note: note ?? null,
    })
    .select("*")
    .single();

  if (orderError || !orderRow) {
    return NextResponse.json(
      { error: "Could not create the order. Please try again." },
      { status: 500 },
    );
  }

  const { error: itemsError } = await supabase.from("order_items").insert(
    lines.map((line) => ({
      order_id: orderRow.id,
      product_id: line.variant.product_id,
      variant_id: line.variant.id,
      name_snapshot: line.variant.products?.name ?? "Coffee",
      size_snapshot: line.variant.size,
      slug_snapshot: line.variant.products?.slug ?? null,
      unit_price_idr: line.variant.price_idr,
      quantity: line.quantity,
    })),
  );

  if (itemsError) {
    // Nothing has been charged yet, so drop the empty order rather than leave
    // an unpayable shell in the admin's list.
    await supabase.from("orders").delete().eq("id", orderRow.id);
    return NextResponse.json(
      { error: "Could not save the order items. Please try again." },
      { status: 500 },
    );
  }

  // -----------------------------------------------------------------------
  // Hand off to the payment provider
  // -----------------------------------------------------------------------
  let intent;
  try {
    intent = await provider.createIntent({
      order: {
        id: orderRow.id,
        humanRef: orderRow.human_ref,
        subtotalIdr,
        shippingIdr: shippingQuote.amountIdr,
        uniqueCode: resolvedTotal.uniqueCode,
        totalIdr: resolvedTotal.totalIdr,
      },
      customer: {
        name: address.recipient_name,
        email,
        phone: address.phone,
      },
      successUrl: `${siteUrl()}/order/${orderRow.id}`,
      failureUrl: `${siteUrl()}/order/${orderRow.id}?payment=failed`,
    });
  } catch (error) {
    await supabase
      .from("orders")
      .update({ status: "cancelled", customer_note: "Payment setup failed" })
      .eq("id", orderRow.id);

    console.error("payment intent failed", error);
    return NextResponse.json(
      {
        error:
          "We could not start the payment. Nothing has been charged — please try again in a moment.",
      },
      { status: 502 },
    );
  }

  await supabase
    .from("orders")
    .update({
      payment_ref: intent.reference,
      payment_url: intent.redirectUrl ?? null,
      payment_expires_at: intent.expiresAt ?? null,
      payment_method: intent.method ?? provider.id,
    })
    .eq("id", orderRow.id);

  if (saveAddress && session) {
    await supabase.from("addresses").insert({
      user_id: session.userId,
      recipient_name: address.recipient_name,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2 ?? null,
      village: address.village ?? null,
      district: address.district ?? null,
      city: address.city,
      province: address.province ?? null,
      postal_code: address.postal_code ?? null,
      country: address.country,
      area_id: address.area_id ?? null,
      is_default: true,
    });
  }

  return NextResponse.json({
    orderId: orderRow.id,
    humanRef: orderRow.human_ref,
    redirectUrl: intent.redirectUrl ?? null,
  });
}
