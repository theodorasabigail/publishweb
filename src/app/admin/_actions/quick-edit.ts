"use server";

import { revalidatePath } from "next/cache";
import { slugify } from "@/lib/utils";
import { adminClient, describeDbError } from "./guard";

/**
 * One field at a time.
 *
 * The product form saves everything at once behind a Save button, which is the
 * right shape for setting a coffee up and the wrong one for "the price of the
 * 1kg went up". These write a single field the moment it changes -- from the
 * sheet, or from the shop page itself in edit mode -- so there is nothing to
 * remember to press.
 *
 * Every field is on an explicit list, with its own parsing. Nothing from the
 * browser chooses a column name.
 */

export type QuickResult = { ok: true } | { ok: false; error: string };

const PRODUCT_TEXT = [
  "name",
  "tasting_notes",
  "description",
  "origin",
  "process",
  "roast_level",
  "varietal",
  "masl",
] as const;
const PRODUCT_FLAGS = ["is_active", "is_featured"] as const;

export type ProductTextField = (typeof PRODUCT_TEXT)[number];
export type ProductFlagField = (typeof PRODUCT_FLAGS)[number];
export type ProductField = ProductTextField | ProductFlagField;
export type VariantField = "price_idr" | "stock" | "is_active" | "size";

function revalidateFor(slug?: string | null) {
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/admin/products");
  revalidatePath("/admin/products/sheet");
  revalidatePath("/admin/pos");
  if (slug) revalidatePath(`/shop/${slug}`);
}

export async function updateProductField(
  productId: string,
  field: ProductField,
  value: string | boolean,
): Promise<QuickResult> {
  const { supabase } = await adminClient();
  if (!productId) return { ok: false, error: "Missing product." };

  let patch: Record<string, string | boolean | null>;
  if ((PRODUCT_TEXT as readonly string[]).includes(field)) {
    const trimmed = String(value ?? "").trim();
    if (field === "name" && !trimmed) {
      return { ok: false, error: "A coffee needs a name." };
    }
    patch = { [field]: trimmed || null };
  } else if ((PRODUCT_FLAGS as readonly string[]).includes(field)) {
    patch = { [field]: value === true || value === "true" };
  } else {
    return { ok: false, error: "That cannot be changed from here." };
  }

  const { data, error } = await supabase
    .from("products")
    .update(patch)
    .eq("id", productId)
    .select("slug")
    .maybeSingle();

  if (error) return { ok: false, error: describeDbError(error, "Could not save that.") };
  revalidateFor((data as { slug: string } | null)?.slug);
  return { ok: true };
}

export async function updateVariantField(
  variantId: string,
  field: VariantField,
  value: string | number | boolean,
): Promise<QuickResult> {
  const { supabase } = await adminClient();
  if (!variantId) return { ok: false, error: "Missing size." };

  const { data: current } = await supabase
    .from("product_variants")
    .select("id, stock, price_idr, products ( slug )")
    .eq("id", variantId)
    .maybeSingle();
  if (!current) return { ok: false, error: "That size no longer exists." };
  const row = current as unknown as {
    stock: number;
    price_idr: number;
    products: { slug: string } | null;
  };

  let patch: Record<string, string | number | boolean>;
  switch (field) {
    case "price_idr": {
      const price = Math.round(Number(value));
      if (!Number.isFinite(price) || price < 0) {
        return { ok: false, error: "A price must be a number, 0 or more." };
      }
      // A size with no price cannot be bought, so it comes off sale with it.
      patch = price > 0 ? { price_idr: price } : { price_idr: 0, is_active: false };
      break;
    }
    case "stock": {
      const stock = Math.round(Number(value));
      if (!Number.isFinite(stock)) return { ok: false, error: "Stock must be a number." };
      // Below zero is bags owed (0039), and only an order puts it there. A
      // typed count is a count of real bags.
      if (stock < 0 && stock !== row.stock) {
        return { ok: false, error: "Stock cannot be typed below zero." };
      }
      patch = { stock };
      break;
    }
    case "is_active": {
      const on = value === true || value === "true";
      if (on && row.price_idr <= 0) {
        return { ok: false, error: "Give it a price before putting it on sale." };
      }
      patch = { is_active: on };
      break;
    }
    case "size": {
      const size = String(value ?? "").trim();
      if (!size) return { ok: false, error: "A size needs a name, like 250g." };
      patch = { size };
      break;
    }
    default:
      return { ok: false, error: "That cannot be changed from here." };
  }

  const { error } = await supabase.from("product_variants").update(patch).eq("id", variantId);
  if (error) {
    return {
      ok: false,
      error:
        error.code === "23505"
          ? "This coffee already has a size with that name."
          : describeDbError(error, "Could not save that."),
    };
  }

  revalidateFor(row.products?.slug);
  return { ok: true };
}

/** A new size on an existing coffee, straight from the sheet. */
export async function addVariant(
  productId: string,
  input: { size: string; price: number; stock: number },
): Promise<QuickResult & { id?: string }> {
  const { supabase } = await adminClient();
  const size = input.size.trim();
  if (!size) return { ok: false, error: "A size needs a name, like 250g." };

  const price = Math.max(0, Math.round(input.price || 0));
  const grams = Number(size.match(/(\d+(?:[.,]\d+)?)\s*(kg|g)\b/i)?.[1]?.replace(",", "."));
  const unit = size.match(/(kg|g)\b/i)?.[1]?.toLowerCase();

  const { data, error } = await supabase
    .from("product_variants")
    .insert({
      product_id: productId,
      size,
      price_idr: price,
      stock: Math.max(0, Math.round(input.stock || 0)),
      // Shipping is priced from weight. Read it from the size when it says
      // ("250g", "1kg"); otherwise the same 250 g guess the form uses.
      weight_grams:
        Number.isFinite(grams) && grams > 0
          ? Math.round(unit === "kg" ? grams * 1000 : grams)
          : 250,
      is_active: price > 0,
    })
    .select("id, products ( slug )")
    .single();

  if (error) {
    return {
      ok: false,
      error:
        error.code === "23505"
          ? "This coffee already has a size with that name."
          : describeDbError(error, "Could not add that size."),
    };
  }

  const added = data as unknown as { id: string; products: { slug: string } | null };
  revalidateFor(added.products?.slug);
  return { ok: true, id: added.id };
}

/**
 * A new coffee from one line: name, a first size, its price and stock.
 *
 * Starts hidden, like a duplicate does: a coffee with no photo or description
 * should not appear on the shop the moment its name is typed. One tap on the
 * sheet puts it on.
 */
export async function quickAddProduct(input: {
  name: string;
  size: string;
  price: number;
  stock: number;
}): Promise<QuickResult & { id?: string }> {
  const { supabase } = await adminClient();
  const name = input.name.trim();
  if (!name) return { ok: false, error: "A coffee needs a name." };

  const base = slugify(name) || "coffee";
  const { data: taken } = await supabase
    .from("products")
    .select("slug")
    .like("slug", `${base}%`);
  const used = new Set(((taken ?? []) as { slug: string }[]).map((row) => row.slug));
  let slug = base;
  for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;

  const { data: last } = await supabase
    .from("products")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("products")
    .insert({
      name,
      slug,
      is_active: false,
      sort_order: ((last as { sort_order: number } | null)?.sort_order ?? 0) + 1,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: describeDbError(error, "Could not add that coffee.") };
  }

  const productId = (data as { id: string }).id;
  if (input.size.trim()) {
    const sized = await addVariant(productId, input);
    if (!sized.ok) return sized;
  }

  revalidateFor(slug);
  return { ok: true, id: productId };
}
