"use server";

import * as z from "zod/v4";
import { AiUnavailableError, aiConfigured, readStructured } from "@/lib/ai/claude";
import {
  describeChange,
  readChangesBasic,
  type CatalogueProduct,
  type ProductChange,
} from "@/lib/product-changes";
import { adminClient } from "./guard";
import {
  addVariant,
  quickAddProduct,
  updateProductField,
  updateVariantField,
} from "./quick-edit";

const ChangeSchema = z.object({
  kind: z.enum([
    "set_stock",
    "add_stock",
    "set_price",
    "size_on_sale",
    "size_off_sale",
    "coffee_on_shop",
    "coffee_off_shop",
    "set_tasting_notes",
    "set_description",
    "new_size",
    "new_coffee",
  ]),
  product_id: z.string().describe('The coffee\'s id from the catalogue, or "" for new_coffee.'),
  variant_id: z
    .string()
    .describe('The size\'s id from the catalogue for size-level changes, otherwise "".'),
  number: z
    .number()
    .describe("Stock count, bags to add, or price in rupiah, for the kinds that take one; else 0."),
  text: z.string().describe('Tasting notes, description or new coffee name; else "".'),
  size: z.string().describe('Size name for new_size / new_coffee, like "250g"; else "".'),
});

const ResultSchema = z.object({
  changes: z.array(ChangeSchema),
  not_understood: z
    .array(z.string())
    .describe("Parts of the request you could not turn into a change, as written."),
});

async function loadCatalogue(): Promise<CatalogueProduct[]> {
  const { supabase } = await adminClient();
  const { data } = await supabase
    .from("products")
    .select("id, name, is_active, tasting_notes, product_variants ( id, size, price_idr, stock, is_active )")
    .order("sort_order");
  return ((data ?? []) as unknown as (Omit<CatalogueProduct, "variants"> & {
    product_variants: CatalogueProduct["variants"];
  })[]).map(({ product_variants, ...product }) => ({ ...product, variants: product_variants ?? [] }));
}

function systemPrompt(catalogue: CatalogueProduct[]): string {
  const lines = catalogue
    .map((product) => {
      const sizes = product.variants
        .map((v) => `    size ${v.id} | ${v.size} | Rp ${v.price_idr} | stock ${v.stock} | ${v.is_active ? "on sale" : "off sale"}`)
        .join("\n");
      return `coffee ${product.id} | ${product.name} | ${product.is_active ? "on shop" : "hidden"} | notes: ${product.tasting_notes ?? ""}\n${sizes}`;
    })
    .join("\n");

  return `You turn a coffee roaster's quick notes about their catalogue into a list of changes. They write in English or Indonesian, briefly ("gayo 200 stok 12", "kinta habis", "naikkan harga 1kg jadi 500rb", "toraja baru 250g 140k").

Kinds of change:
- set_stock: the stock count becomes a number ("stock 12", "sisa 5"). "Sold out"/"habis" means set_stock 0 on the sizes named, or on every size if none is named.
- add_stock: bags to add to the current stock ("+10", "roasted 10", "tambah 10").
- set_price: a new price in rupiah ("140rb" = 140000, "1,2jt" = 1200000).
- size_on_sale / size_off_sale: one size can or cannot be bought.
- coffee_on_shop / coffee_off_shop: show or hide the whole coffee on the website.
- set_tasting_notes / set_description: replace the text.
- new_size: a new size on an existing coffee, with its price in number.
- new_coffee: a coffee not in the catalogue; its name in text, first size in size, price in number.

Use ids exactly as listed. Make one change per size affected. If something is ambiguous (which size? which coffee?), do not guess: put it in not_understood.

Catalogue:
${lines}`;
}

export interface ReadChangesResult {
  ok: boolean;
  changes: ProductChange[];
  notUnderstood: string[];
  source: "ai" | "basic";
  notice?: string;
  error?: string;
}

export async function readProductChanges(text: string): Promise<ReadChangesResult> {
  await adminClient();
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, changes: [], notUnderstood: [], source: "basic", error: "Type what changed first." };
  }
  const catalogue = await loadCatalogue();

  if (aiConfigured()) {
    try {
      const result = await readStructured({
        schema: ResultSchema,
        system: systemPrompt(catalogue),
        text: trimmed.slice(0, 8000),
      });
      const notUnderstood = [...result.not_understood];
      const changes: ProductChange[] = [];

      for (const raw of result.changes) {
        const product = catalogue.find((item) => item.id === raw.product_id);
        const needsVariant = ["set_stock", "add_stock", "set_price", "size_on_sale", "size_off_sale"].includes(raw.kind);
        const variant = product?.variants.find((item) => item.id === raw.variant_id);
        // Every id is checked against the catalogue; Claude never gets to
        // point a change at something that is not there.
        if (raw.kind !== "new_coffee" && !product) continue;
        if (needsVariant && !variant) continue;
        if (raw.kind === "new_coffee" && !raw.text.trim()) continue;

        const change: ProductChange = {
          kind: raw.kind,
          productId: raw.kind === "new_coffee" ? "" : raw.product_id,
          variantId: needsVariant ? raw.variant_id : "",
          number: Math.round(raw.number || 0),
          text: raw.text.trim(),
          size: raw.size.trim(),
          summary: "",
        };
        change.summary = describeChange(change, catalogue);
        changes.push(change);
      }

      return { ok: true, changes, notUnderstood, source: "ai" };
    } catch (error) {
      if (!(error instanceof AiUnavailableError)) throw error;
      const basic = readChangesBasic(trimmed, catalogue);
      return { ok: true, ...basic, source: "basic", notice: error.message };
    }
  }

  return { ok: true, ...readChangesBasic(trimmed, catalogue), source: "basic" };
}

/** Apply the changes the operator ticked, one at a time, reporting each. */
export async function applyProductChanges(
  changes: ProductChange[],
): Promise<{ summary: string; ok: boolean; error?: string }[]> {
  const { supabase } = await adminClient();
  const results: { summary: string; ok: boolean; error?: string }[] = [];

  for (const change of changes.slice(0, 100)) {
    let result: { ok: boolean; error?: string };
    switch (change.kind) {
      case "set_stock": {
        const { data } = await supabase
          .from("product_variants")
          .select("stock")
          .eq("id", change.variantId)
          .maybeSingle();
        const current = (data as { stock: number } | null)?.stock;
        // "Sold out" on a size already below zero (bags owed) is already
        // true; setting it to 0 would forget what is owed.
        result =
          current !== undefined && current < 0 && change.number <= 0
            ? { ok: true }
            : await updateVariantField(change.variantId, "stock", Math.max(0, change.number));
        break;
      }
      case "add_stock": {
        const { data } = await supabase
          .from("product_variants")
          .select("stock")
          .eq("id", change.variantId)
          .maybeSingle();
        const current = (data as { stock: number } | null)?.stock;
        result =
          current === undefined
            ? { ok: false, error: "That size no longer exists." }
            : await updateVariantField(change.variantId, "stock", current + change.number);
        break;
      }
      case "set_price":
        result = await updateVariantField(change.variantId, "price_idr", change.number);
        break;
      case "size_on_sale":
      case "size_off_sale":
        result = await updateVariantField(change.variantId, "is_active", change.kind === "size_on_sale");
        break;
      case "coffee_on_shop":
      case "coffee_off_shop":
        result = await updateProductField(change.productId, "is_active", change.kind === "coffee_on_shop");
        break;
      case "set_tasting_notes":
        result = await updateProductField(change.productId, "tasting_notes", change.text);
        break;
      case "set_description":
        result = await updateProductField(change.productId, "description", change.text);
        break;
      case "new_size":
        result = await addVariant(change.productId, {
          size: change.size,
          price: change.number,
          stock: 0,
        });
        break;
      case "new_coffee":
        result = await quickAddProduct({
          name: change.text,
          size: change.size,
          price: change.number,
          stock: 0,
        });
        break;
      default:
        result = { ok: false, error: "Not something this can change." };
    }
    results.push({ summary: change.summary, ok: result.ok, error: result.ok ? undefined : result.error });
  }

  return results;
}
