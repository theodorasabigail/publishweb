"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod/v4";
import { AiUnavailableError, readStructured } from "@/lib/ai/claude";
import {
  sizeGrams,
  sizeLabel,
  type PriceListRow,
  type PriceListSize,
} from "@/lib/price-list";
import { slugify } from "@/lib/utils";
import { adminClient, describeDbError } from "./guard";

/**
 * Apply a checked price list.
 *
 * The browser sends what the operator approved: for each coffee on the list,
 * which existing coffee it is (or none, for a new one) and its sizes and
 * prices; plus the sizes and coffees they chose to take off sale. Everything
 * else is worked out again here from the database as it is now -- sizes are
 * matched by weight, not by trusting ids from the page -- so a list checked a
 * while ago still lands correctly.
 *
 * Nothing is deleted. A size or coffee no longer sold is switched off, which
 * keeps its order history and is one tap to undo.
 */

export interface PriceImportItem {
  productId: string | null;
  name: string;
  region: string;
  sizes: PriceListSize[];
  /** Sizes of this coffee to take off sale. */
  offSaleVariantIds: string[];
}

export interface PriceImportResult {
  ok: boolean;
  error?: string;
  added: number;
  updatedPrices: number;
  newSizes: number;
  offSale: number;
  hidden: number;
  failures: string[];
}

export async function applyPriceImport(input: {
  items: PriceImportItem[];
  hideProductIds: string[];
  showNewCoffees: boolean;
}): Promise<PriceImportResult> {
  const { supabase } = await adminClient();
  const result: PriceImportResult = {
    ok: true,
    added: 0,
    updatedPrices: 0,
    newSizes: 0,
    offSale: 0,
    hidden: 0,
    failures: [],
  };

  const items = input.items.slice(0, 300);

  // Regions become the category for new coffees when a category of that
  // name already exists ("Africa", "Sumatra"); otherwise they are left
  // uncategorised rather than inventing categories nobody asked for.
  const { data: categoryRows } = await supabase.from("categories").select("id, name");
  const categoryByName = new Map(
    ((categoryRows ?? []) as { id: string; name: string }[]).map((row) => [
      row.name.trim().toLowerCase(),
      row.id,
    ]),
  );

  const { data: slugRows } = await supabase.from("products").select("slug");
  const usedSlugs = new Set(((slugRows ?? []) as { slug: string }[]).map((row) => row.slug));
  const { data: last } = await supabase
    .from("products")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  let sortOrder = ((last as { sort_order: number } | null)?.sort_order ?? 0) + 1;

  for (const item of items) {
    const sizes = item.sizes
      .map((size) => ({ ...size, grams: sizeGrams(size.size) ?? size.grams }))
      .filter((size) => size.grams > 0 && Number.isFinite(size.price) && size.price > 0);

    let productId = item.productId;

    if (!productId) {
      const name = item.name.trim();
      if (!name) continue;
      const base = slugify(name) || "coffee";
      let slug = base;
      for (let n = 2; usedSlugs.has(slug); n++) slug = `${base}-${n}`;
      usedSlugs.add(slug);

      const { data, error } = await supabase
        .from("products")
        .insert({
          name,
          slug,
          origin: item.region.trim() || null,
          category_id: categoryByName.get(item.region.trim().toLowerCase()) ?? null,
          is_active: input.showNewCoffees,
          sort_order: sortOrder++,
        })
        .select("id")
        .single();
      if (error || !data) {
        result.failures.push(`${name}: ${describeDbError(error, "could not be added")}`);
        continue;
      }
      productId = (data as { id: string }).id;
      result.added++;
    }

    const { data: variantRows } = await supabase
      .from("product_variants")
      .select("id, size, price_idr, is_active")
      .eq("product_id", productId);
    const variants = ((variantRows ?? []) as {
      id: string;
      size: string;
      price_idr: number;
      is_active: boolean;
    }[]).map((variant) => ({ ...variant, grams: sizeGrams(variant.size) }));

    for (const size of sizes) {
      const existing = variants.find((variant) => variant.grams === size.grams);
      if (existing) {
        if (existing.price_idr === size.price && existing.is_active) continue;
        const { error } = await supabase
          .from("product_variants")
          .update({ price_idr: size.price, is_active: true })
          .eq("id", existing.id);
        if (error) result.failures.push(`${item.name} ${existing.size}: ${describeDbError(error, "not saved")}`);
        else if (existing.price_idr !== size.price) result.updatedPrices++;
        continue;
      }

      const { error } = await supabase.from("product_variants").insert({
        product_id: productId,
        size: sizeLabel(size.grams),
        price_idr: size.price,
        stock: 0,
        weight_grams: size.grams,
        is_active: true,
      });
      if (error) {
        result.failures.push(`${item.name} ${sizeLabel(size.grams)}: ${describeDbError(error, "not added")}`);
      } else {
        result.newSizes++;
      }
    }

    // Only sizes that belong to this coffee can be switched off from its row.
    const offIds = item.offSaleVariantIds.filter((id) => variants.some((variant) => variant.id === id));
    if (offIds.length) {
      const { error } = await supabase
        .from("product_variants")
        .update({ is_active: false })
        .in("id", offIds);
      if (error) result.failures.push(`${item.name}: sizes not taken off sale`);
      else result.offSale += offIds.length;
    }
  }

  if (input.hideProductIds.length) {
    const { error } = await supabase
      .from("products")
      .update({ is_active: false })
      .in("id", input.hideProductIds.slice(0, 300));
    if (error) result.failures.push("Coffees not on the list could not be hidden.");
    else result.hidden = input.hideProductIds.length;
  }

  revalidatePath("/");
  revalidatePath("/shop", "layout");
  revalidatePath("/admin/products");
  revalidatePath("/admin/products/sheet");
  revalidatePath("/admin/pos");

  result.ok = result.failures.length === 0;
  return result;
}

// ---------------------------------------------------------------------------
// Reading a price list from a picture
// ---------------------------------------------------------------------------

const ImageListSchema = z.object({
  rows: z.array(
    z.object({
      region: z
        .string()
        .describe('The region heading this coffee sits under ("Jawa Barat", "Africa"), or "".'),
      name: z.string().describe("The coffee's name, copied exactly as written."),
      prices: z.array(
        z.object({
          size: z.string().describe('The size column heading as written, e.g. "45gr" or "1KG".'),
          price: z.number().describe("The price in rupiah as a whole number: 58,000 is 58000."),
        }),
      ),
    }),
  ),
  unreadable: z
    .array(z.string())
    .describe("Cells or rows you could not read with confidence, described briefly."),
});

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;

/**
 * Read a screenshot or photo of the price list into rows, the same shape a
 * pasted spreadsheet gives, for the same check-before-apply screen. Needs the
 * Anthropic key; without it the operator is told to paste the cells instead.
 */
export async function readPriceListImage(
  formData: FormData,
): Promise<{ rows: PriceListRow[]; unreadable: string[]; error?: string }> {
  await adminClient();

  const file = formData.get("image");
  if (!(file instanceof File) || !file.size) {
    return { rows: [], unreadable: [], error: "Choose a picture of the price list first." };
  }
  const mediaType = IMAGE_TYPES.find((type) => type === file.type);
  if (!mediaType) {
    return { rows: [], unreadable: [], error: "That picture type cannot be read — use a JPEG, PNG or WebP." };
  }
  if (file.size > 4_000_000) {
    return { rows: [], unreadable: [], error: "That picture is too large — try a screenshot instead of a photo." };
  }

  let result: z.infer<typeof ImageListSchema>;
  try {
    result = await readStructured({
      schema: ImageListSchema,
      image: { data: Buffer.from(await file.arrayBuffer()), mediaType },
      system: `You read a coffee roaster's price list from a picture of their spreadsheet.

The sheet has a column of coffee names and one column per bag size (for example 15gr, 30gr, 45gr, 75gr, 150gr, 300gr, 1KG), with prices in rupiah in the cells. Rows that have a name but no prices are region headings ("Jawa Barat", "Africa", "Sumatra"); they are not coffees -- give each coffee the region of the heading above it.

For every coffee, list only the sizes that have a price in its row; an empty cell means that size is not sold. Copy names exactly, including spelling. Prices are whole rupiah: "58,000" and "58000" are both 58000, "82,500" is 82500.

Read carefully, column by column -- a price in the wrong size column is worse than none. If a cell is blurred, cut off or unclear, leave it out and describe it in unreadable instead of guessing.`,
      text: "Read every coffee and its prices from this price list.",
    });
  } catch (error) {
    if (error instanceof AiUnavailableError) {
      return {
        rows: [],
        unreadable: [],
        error: `${error.message} Or copy the cells from the spreadsheet and paste them instead.`,
      };
    }
    throw error;
  }

  const rows: PriceListRow[] = [];
  for (const row of result.rows) {
    const name = row.name.trim();
    if (!name) continue;
    const sizes = new Map<number, PriceListSize>();
    for (const cell of row.prices) {
      const grams = sizeGrams(cell.size);
      const price = Math.round(cell.price);
      if (grams && Number.isFinite(price) && price > 0) {
        sizes.set(grams, { size: sizeLabel(grams), grams, price });
      }
    }
    if (sizes.size) {
      rows.push({
        name,
        region: row.region.trim(),
        sizes: [...sizes.values()].sort((a, b) => a.grams - b.grams),
      });
    }
  }

  if (!rows.length) {
    return {
      rows,
      unreadable: result.unreadable,
      error: "No coffees with prices could be read from that picture.",
    };
  }
  return { rows, unreadable: result.unreadable };
}
