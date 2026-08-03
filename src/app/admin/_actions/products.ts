"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { VARIANT_SIZES } from "@/lib/types";
import { slugify } from "@/lib/utils";
import {
  adminClient,
  boolean,
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
    accent_color: text(formData, "accent_color") || "#8c6144",
    is_active: boolean(formData, "is_active"),
    is_featured: boolean(formData, "is_featured"),
    sort_order: integer(formData, "sort_order"),
    seo_title: optionalText(formData, "seo_title"),
    seo_description: optionalText(formData, "seo_description"),
    og_image_url: optionalText(formData, "og_image_url"),
  };
}

/** Variant rows are always the three sizes; a size the operator leaves blank
 *  is simply deactivated rather than deleted, so its stock history survives. */
async function upsertVariants(
  supabase: Awaited<ReturnType<typeof adminClient>>["supabase"],
  productId: string,
  formData: FormData,
) {
  const rows = VARIANT_SIZES.map((size) => {
    const price = integer(formData, `price_${size}`, 0);
    return {
      product_id: productId,
      size,
      price_idr: Math.max(0, price),
      stock: Math.max(0, integer(formData, `stock_${size}`, 0)),
      weight_grams: Math.max(0, integer(formData, `weight_${size}`, 0)),
      is_active: price > 0 && boolean(formData, `active_${size}`),
    };
  });

  await supabase.from("product_variants").upsert(rows, { onConflict: "product_id,size" });
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
        : "Could not save the product.",
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
        : "Could not save the product.",
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
