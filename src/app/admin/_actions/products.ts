"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { slugify } from "@/lib/utils";
import {
  adminClient,
  boolean,
  describeDbError,
  integer,
  optionalText,
  text,
} from "./guard";

function revalidateStorefront(slug?: string | null) {
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/admin/products");
  if (slug) revalidatePath(`/shop/${slug}`);
}

function productFields(formData: FormData) {
  const name = text(formData, "name");
  const slug = slugify(text(formData, "slug") || name);

  return {
    name,
    slug,
    description: optionalText(formData, "description"),
    origin: optionalText(formData, "origin"),
    process: optionalText(formData, "process"),
    roast_level: optionalText(formData, "roast_level"),
    varietal: optionalText(formData, "varietal"),
    masl: optionalText(formData, "masl"),
    tasting_notes: optionalText(formData, "tasting_notes"),
    category_id: optionalText(formData, "category_id"),
    image_url: optionalText(formData, "image_url"),
    image_alt: optionalText(formData, "image_alt"),
    // 0 is the "not set yet" option in the picker, and must become null rather
    // than failing the 1-6 check constraint.
    flavour_level: integer(formData, "flavour_level", 0) || null,
    is_active: boolean(formData, "is_active"),
    is_featured: boolean(formData, "is_featured"),
    sort_order: integer(formData, "sort_order"),
    seo_title: optionalText(formData, "seo_title"),
    seo_description: optionalText(formData, "seo_description"),
    og_image_url: optionalText(formData, "og_image_url"),
  };
}

/**
 * Save whatever sizes the form submitted.
 *
 * Rows arrive indexed with a count alongside, rather than one field per known
 * size, because there is no longer a known set -- the operator invents them.
 * A size removed from the form is deleted; order history is unaffected, since
 * order_items keep their own name and size snapshots and the foreign key is
 * `on delete set null` precisely so a discontinued pack cannot rewrite a
 * receipt.
 */
async function upsertVariants(
  supabase: Awaited<ReturnType<typeof adminClient>>["supabase"],
  productId: string,
  formData: FormData,
) {
  const count = Math.min(integer(formData, "variant_count", 0), 40);

  const rows: {
    product_id: string;
    size: string;
    price_idr: number;
    stock: number;
    weight_grams: number;
    is_active: boolean;
  }[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < count; index++) {
    const size = text(formData, `variant_size_${index}`);
    // A blank row is someone who pressed "Add a size" and changed their mind.
    if (!size) continue;
    // The database has a unique constraint on (product_id, size); two rows
    // with one name would fail the whole save with a constraint error nobody
    // could act on. Last one entered wins, silently.
    if (seen.has(size.toLowerCase())) continue;
    seen.add(size.toLowerCase());

    const price = Math.max(0, integer(formData, `variant_price_${index}`, 0));

    rows.push({
      product_id: productId,
      size,
      price_idr: price,
      stock: Math.max(0, integer(formData, `variant_stock_${index}`, 0)),
      // Never zero: shipping is priced from this, and a zero silently becomes
      // a 250 g guess at quote time. Falling back to the same guess here at
      // least makes it visible in the admin afterwards.
      weight_grams: Math.max(1, integer(formData, `variant_weight_${index}`, 250)),
      is_active: price > 0 && boolean(formData, `variant_active_${index}`),
    });
  }

  if (!rows.length) return;

  await supabase
    .from("product_variants")
    .upsert(rows, { onConflict: "product_id,size" });

  // Sizes the operator deleted from the form. Done after the upsert so a
  // failed save never leaves a product with nothing to buy, and scoped to this
  // product so it can only ever remove what this form was editing.
  await supabase
    .from("product_variants")
    .delete()
    .eq("product_id", productId)
    .not("size", "in", `(${rows.map((row) => `"${row.size.replace(/"/g, '""')}"`).join(",")})`);
}

export async function createProduct(formData: FormData) {
  const { supabase } = await adminClient();
  const fields = productFields(formData);

  if (!fields.name) throw new Error("A product needs a name.");

  const { data, error } = await supabase
    .from("products")
    .insert(fields)
    .select("id, slug")
    .single();

  if (error) {
    throw new Error(
      error.code === "23505"
        ? "That URL slug is already taken by another product."
        : describeDbError(error, "Could not save the product."),
    );
  }

  await upsertVariants(supabase, data.id, formData);
  revalidateStorefront(data.slug);
  redirect(`/admin/products/${data.id}?saved=1`);
}

export async function updateProduct(formData: FormData) {
  const { supabase } = await adminClient();
  const id = text(formData, "id");
  if (!id) throw new Error("Missing product id.");

  const fields = productFields(formData);
  const { error } = await supabase.from("products").update(fields).eq("id", id);

  if (error) {
    throw new Error(
      error.code === "23505"
        ? "That URL slug is already taken by another product."
        : describeDbError(error, "Could not save the product."),
    );
  }

  await upsertVariants(supabase, id, formData);
  revalidateStorefront(fields.slug);
  redirect(`/admin/products/${id}?saved=1`);
}

/** Copy a product and its pricing, deactivated and renamed, so a new lot can
 *  start from last season's setup instead of a blank form. */
export async function duplicateProduct(formData: FormData) {
  const { supabase } = await adminClient();
  const id = text(formData, "id");

  const { data: original } = await supabase
    .from("products")
    .select("*, product_variants (*)")
    .eq("id", id)
    .single();

  if (!original) throw new Error("Product not found.");

  const {
    id: _id,
    created_at: _createdAt,
    updated_at: _updatedAt,
    product_variants: variants,
    ...rest
  } = original;

  const { data: copy, error } = await supabase
    .from("products")
    .insert({
      ...rest,
      name: `${original.name} (copy)`,
      slug: `${original.slug}-copy-${Date.now().toString(36).slice(-4)}`,
      is_active: false,
      is_featured: false,
    })
    .select("id")
    .single();

  if (error || !copy) throw new Error("Could not duplicate the product.");

  if (Array.isArray(variants) && variants.length) {
    await supabase.from("product_variants").insert(
      variants.map((variant) => ({
        product_id: copy.id,
        size: variant.size,
        price_idr: variant.price_idr,
        stock: 0,
        weight_grams: variant.weight_grams,
        is_active: variant.is_active,
      })),
    );
  }

  revalidateStorefront();
  redirect(`/admin/products/${copy.id}?duplicated=1`);
}

export async function toggleProductActive(formData: FormData) {
  const { supabase } = await adminClient();
  const id = text(formData, "id");
  const next = boolean(formData, "next");

  await supabase.from("products").update({ is_active: next }).eq("id", id);
  revalidateStorefront();
}

export async function toggleProductFeatured(formData: FormData) {
  const { supabase } = await adminClient();
  const id = text(formData, "id");
  const next = boolean(formData, "next");

  await supabase.from("products").update({ is_featured: next }).eq("id", id);
  revalidateStorefront();
}

/** Presentation control (spec §7.2): the order products appear in. */
export async function reorderProducts(order: { id: string; sort_order: number }[]) {
  const { supabase } = await adminClient();

  await Promise.all(
    order.map((item) =>
      supabase.from("products").update({ sort_order: item.sort_order }).eq("id", item.id),
    ),
  );

  revalidateStorefront();
  return { ok: true };
}

export async function deleteProduct(formData: FormData) {
  const { supabase } = await adminClient();
  const id = text(formData, "id");

  // Order items keep name/size snapshots, so past orders survive this intact.
  await supabase.from("products").delete().eq("id", id);
  revalidateStorefront();
  redirect("/admin/products");
}

// ---------------------------------------------------------------------------
// Bulk edits
//
// Day-to-day running of a roastery is repetitive: a green price moves and
// twelve coffees need the same rise, a lot sells out and six need hiding, a
// season ends and a batch needs deleting. Doing that one product at a time is
// twelve form loads and twelve chances to mistype.
//
// Every action here takes an explicit list of ids from the selection, so
// nothing can ever apply to "everything" through a missing filter.
// ---------------------------------------------------------------------------

/** Nothing selected must be a no-op, never an unbounded update. */
function assertSelection(ids: string[]): string[] {
  const clean = [...new Set(ids.filter(Boolean))];
  if (!clean.length) throw new Error("Nothing was selected.");
  if (clean.length > 500) throw new Error("Too many products at once.");
  return clean;
}

export async function bulkSetProductFlags(
  ids: string[],
  patch: {
    is_active?: boolean;
    is_featured?: boolean;
    category_id?: string | null;
    flavour_level?: number | null;
  },
) {
  const { supabase } = await adminClient();
  const selection = assertSelection(ids);

  // Only the keys actually supplied, so setting one thing never blanks another.
  const update: Record<string, unknown> = {};
  if (patch.is_active !== undefined) update.is_active = patch.is_active;
  if (patch.is_featured !== undefined) update.is_featured = patch.is_featured;
  if (patch.category_id !== undefined) update.category_id = patch.category_id;
  if (patch.flavour_level !== undefined) {
    update.flavour_level =
      patch.flavour_level && patch.flavour_level >= 1 && patch.flavour_level <= 6
        ? patch.flavour_level
        : null;
  }
  if (!Object.keys(update).length) return;
  update.updated_at = new Date().toISOString();

  const { error } = await supabase.from("products").update(update).in("id", selection);
  if (error) throw new Error(describeDbError(error, "Could not update those products."));

  revalidateStorefront();
}

/**
 * Move prices on every size of the selected coffees.
 *
 * Percentages rather than fixed amounts are the common case — a green coffee
 * price rises by a proportion, and a 100 g bag should not absorb the same
 * rupiah as a 1 kg one. Rounding is applied after, because a 7% rise turns
 * tidy prices into 90,752 and nobody prints that on a menu.
 */
export async function bulkAdjustPrices(
  ids: string[],
  options: { mode: "percent" | "amount"; value: number; roundTo: number },
): Promise<{ updated: number }> {
  const { supabase } = await adminClient();
  const selection = assertSelection(ids);

  if (!Number.isFinite(options.value) || options.value === 0) {
    throw new Error("Enter an amount to change prices by.");
  }
  if (options.mode === "percent" && options.value <= -100) {
    throw new Error("That would take every price to zero or below.");
  }

  const { data, error } = await supabase
    .from("product_variants")
    .select("id, price_idr")
    .in("product_id", selection);

  if (error) throw new Error("Could not read the current prices.");

  const rows = (data ?? []) as { id: string; price_idr: number }[];
  const round = Math.max(1, Math.round(options.roundTo || 1));

  const changed = rows
    .map((row) => {
      const raw =
        options.mode === "percent"
          ? row.price_idr * (1 + options.value / 100)
          : row.price_idr + options.value;

      // Never negative, and never silently zero — a zero price also means
      // "not on sale" elsewhere in the system, so it must be a deliberate act.
      const next = Math.max(round, Math.round(raw / round) * round);
      return { id: row.id, price_idr: next };
    })
    .filter((row, index) => row.price_idr !== rows[index].price_idr);

  if (!changed.length) return { updated: 0 };

  // Updated one at a time rather than through upsert: an upsert here would
  // need every not-null column of the row and would silently reset anything
  // omitted. Batched so a large selection is still a handful of round trips.
  for (let i = 0; i < changed.length; i += 50) {
    await Promise.all(
      changed.slice(i, i + 50).map((row) =>
        supabase
          .from("product_variants")
          .update({ price_idr: row.price_idr })
          .eq("id", row.id),
      ),
    );
  }

  revalidateStorefront();
  return { updated: changed.length };
}

/**
 * Delete products outright.
 *
 * Safe for order history: order_items keep their own name, size and price
 * snapshots and their foreign keys are `on delete set null`, precisely so a
 * discontinued coffee can never rewrite a receipt. Variants go with the
 * product through `on delete cascade`.
 */
export async function bulkDeleteProducts(ids: string[]): Promise<{ deleted: number }> {
  const { supabase } = await adminClient();
  const selection = assertSelection(ids);

  const { error } = await supabase.from("products").delete().in("id", selection);
  if (error) throw new Error("Could not delete those products.");

  revalidateStorefront();
  return { deleted: selection.length };
}

/** Adjust stock on every size of the selected coffees — after a roast. */
export async function bulkAdjustStock(
  ids: string[],
  options: { mode: "set" | "add"; value: number },
): Promise<{ updated: number }> {
  const { supabase } = await adminClient();
  const selection = assertSelection(ids);

  const value = Math.round(options.value);
  if (!Number.isFinite(value)) throw new Error("Enter a number of bags.");

  const { data, error } = await supabase
    .from("product_variants")
    .select("id, stock")
    .in("product_id", selection);

  if (error) throw new Error("Could not read the current stock.");

  const rows = (data ?? []) as { id: string; stock: number }[];
  const changed = rows
    .map((row) => ({
      id: row.id,
      stock: Math.max(0, options.mode === "set" ? value : row.stock + value),
    }))
    .filter((row, index) => row.stock !== rows[index].stock);

  if (!changed.length) return { updated: 0 };

  for (let i = 0; i < changed.length; i += 50) {
    await Promise.all(
      changed.slice(i, i + 50).map((row) =>
        supabase.from("product_variants").update({ stock: row.stock }).eq("id", row.id),
      ),
    );
  }

  revalidateStorefront();
  return { updated: changed.length };
}
