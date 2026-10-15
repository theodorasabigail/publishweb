/**
 * Changes to the catalogue, described in words and checked before they apply.
 *
 * "Gayo 200g stock 12, Kintamani sold out, new coffee Toraja Sapan 250g
 * 140rb" becomes a list of these, each with a plain sentence saying exactly
 * what will happen ("Gayo Arunika 200g: stock 4 → 12"). The operator ticks
 * the ones they meant and applies them; nothing changes before that.
 */

export type ChangeKind =
  | "set_stock"
  | "add_stock"
  | "set_price"
  | "size_on_sale"
  | "size_off_sale"
  | "coffee_on_shop"
  | "coffee_off_shop"
  | "set_tasting_notes"
  | "set_description"
  | "new_size"
  | "new_coffee";

export interface ProductChange {
  kind: ChangeKind;
  productId: string;
  variantId: string;
  /** Stock, bags to add, or a price, for the kinds that take one. */
  number: number;
  /** Tasting notes, a description, or a new coffee's name. */
  text: string;
  /** A new size's name, for new_size and new_coffee. */
  size: string;
  /** "Gayo Arunika 200g: stock 4 → 12" -- what the operator approves. */
  summary: string;
}

export interface CatalogueProduct {
  id: string;
  name: string;
  is_active: boolean;
  tasting_notes: string | null;
  variants: { id: string; size: string; price_idr: number; stock: number; is_active: boolean }[];
}

function plain(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function grams(value: string): number | null {
  const match = plain(value).match(/(\d+(?:\s\d+)?)\s?(kg|kilo|g|gr|gram)\b/);
  if (!match) return null;
  const number = Number(match[1].replace(" ", "."));
  return /k/.test(match[2]) ? number * 1000 : number;
}

/** "140rb", "140k", "140.000", "Rp 140,000" -> 140000. */
export function rupiah(value: string): number | null {
  const match = value.toLowerCase().match(/(?:rp\.?\s*)?(\d[\d.,]*)\s*(rb|ribu|k|jt|juta)?\b/);
  if (!match) return null;
  const digits = Number(match[1].replace(/[.,](?=\d{3}\b)/g, "").replace(",", "."));
  if (!Number.isFinite(digits)) return null;
  const unit = match[2];
  if (unit === "jt" || unit === "juta") return Math.round(digits * 1_000_000);
  if (unit) return Math.round(digits * 1000);
  return Math.round(digits);
}

/** The sentence shown for a change, from the catalogue as it is now. */
export function describeChange(change: ProductChange, catalogue: CatalogueProduct[]): string {
  const product = catalogue.find((item) => item.id === change.productId);
  const variant = product?.variants.find((item) => item.id === change.variantId);
  const label = [product?.name, variant?.size].filter(Boolean).join(" ");
  const idr = (value: number) => `Rp ${value.toLocaleString("id-ID")}`;

  switch (change.kind) {
    case "set_stock":
      return `${label}: stock ${variant?.stock ?? "?"} → ${change.number}`;
    case "add_stock":
      return `${label}: add ${change.number} ${change.number === 1 ? "bag" : "bags"} (stock ${variant?.stock ?? "?"} → ${(variant?.stock ?? 0) + change.number})`;
    case "set_price":
      return `${label}: price ${variant ? idr(variant.price_idr) : "?"} → ${idr(change.number)}`;
    case "size_on_sale":
      return `${label}: put on sale`;
    case "size_off_sale":
      return `${label}: take off sale`;
    case "coffee_on_shop":
      return `${product?.name}: show on the shop`;
    case "coffee_off_shop":
      return `${product?.name}: hide from the shop`;
    case "set_tasting_notes":
      return `${product?.name}: tasting notes → “${change.text}”`;
    case "set_description":
      return `${product?.name}: new description — “${change.text.length > 80 ? `${change.text.slice(0, 80)}…` : change.text}”`;
    case "new_size":
      return `${product?.name}: new size ${change.size} at ${idr(change.number)}`;
    case "new_coffee":
      return `New coffee “${change.text}”${change.size ? `, ${change.size}${change.number > 0 ? ` at ${idr(change.number)}` : ""}` : ""} (starts hidden)`;
  }
}

/**
 * Without AI: one change per comma or line, for the common shapes --
 * "Gayo 200g stock 12", "Gayo 200g +10", "Gayo 1kg harga 500rb",
 * "Kintamani habis". Anything else is returned as not understood.
 */
export function readChangesBasic(
  text: string,
  catalogue: CatalogueProduct[],
): { changes: ProductChange[]; notUnderstood: string[] } {
  const changes: ProductChange[] = [];
  const notUnderstood: string[] = [];

  for (const raw of text.split(/[\n,;]+/).map((part) => part.trim()).filter(Boolean)) {
    const line = plain(raw);
    const product = catalogue
      .filter((item) =>
        plain(item.name)
          .split(" ")
          .filter((word) => word.length >= 4)
          .some((word) => line.includes(word)),
      )
      .sort((a, b) => b.name.length - a.name.length)[0];

    if (!product) {
      notUnderstood.push(raw);
      continue;
    }

    const size = grams(raw);
    const sized = size !== null ? product.variants.filter((item) => grams(item.size) === size) : [];
    const targets = sized.length ? sized : product.variants;
    const base = { productId: product.id, text: "", size: "", summary: "" };
    const rest = line.replace(/\d+(?:\s\d+)?\s?(kg|kilo|g|gr|gram)\b/, " ");
    // The "+" in "+10" is punctuation to plain(), so look for it in the raw text.
    const added = raw
      .toLowerCase()
      .replace(/\d+(?:[.,]\d+)?\s?(kg|kilo|gr?|gram)\b/, " ")
      .match(/(?:\+|tambah|add|roast(?:ed)?)\s?(\d+)/);

    if (/\b(habis|sold out|kosong)\b/.test(line)) {
      for (const variant of targets) {
        changes.push({ ...base, kind: "set_stock", variantId: variant.id, number: 0 });
      }
    } else if (/\b(sembunyi|sembunyikan|hide|hidden)\b/.test(line)) {
      changes.push({ ...base, kind: "coffee_off_shop", variantId: "", number: 0 });
    } else if (/\b(tampil|tampilkan|show)\b/.test(line)) {
      changes.push({ ...base, kind: "coffee_on_shop", variantId: "", number: 0 });
    } else if (/\b(harga|price)\b/.test(line) && targets.length === 1) {
      const price = rupiah(raw.replace(/\d+(?:[.,]\d+)?\s?(kg|kilo|gr?|gram)\b/i, ""));
      if (price === null) notUnderstood.push(raw);
      else changes.push({ ...base, kind: "set_price", variantId: targets[0].id, number: price });
    } else if (targets.length === 1 && added) {
      changes.push({ ...base, kind: "add_stock", variantId: targets[0].id, number: Number(added[1]) });
    } else if (targets.length === 1 && /\b(\d{1,4})\b/.test(rest)) {
      const count = Number(rest.match(/\b(\d{1,4})\b/)?.[1]);
      changes.push({ ...base, kind: "set_stock", variantId: targets[0].id, number: count });
    } else {
      notUnderstood.push(raw);
    }
  }

  return {
    changes: changes.map((change) => ({ ...change, summary: describeChange(change, catalogue) })),
    notUnderstood,
  };
}
