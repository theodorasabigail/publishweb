/**
 * A price list pasted from a spreadsheet.
 *
 * The roastery keeps its prices in a sheet shaped like this:
 *
 *   Coffee                         | 15gr | 30gr | 45gr   | 75gr   | 150gr   | 300gr   | 1KG
 *   Jawa Barat                     |      |      |        |        |         |         |
 *   Palintang Washed Java Ateng    |      |      | 58,000 | 75,000 | 140,000 | 250,000 |
 *
 * Copying cells out of Google Sheets or Excel gives tab-separated text, which
 * is what this reads. A row with a name and no prices is a region heading
 * ("Jawa Barat", "Africa"); every coffee under it belongs to that region.
 *
 * Nothing here touches the database. It turns the paste into rows, then into
 * a plan against the catalogue -- what is new, what changed, what is not on
 * the list any more -- for the operator to check before anything is applied.
 */

export interface PriceListSize {
  /** As the shop names it: "45g", "1kg". */
  size: string;
  grams: number;
  price: number;
}

export interface PriceListRow {
  name: string;
  region: string;
  sizes: PriceListSize[];
}

/** "45gr", "45 g", "1KG", "0.5 kg", "1 kilo" -> grams. Null for anything else. */
export function sizeGrams(label: string): number | null {
  const match = label
    .toLowerCase()
    .replace(",", ".")
    .match(/^\s*(\d+(?:\.\d+)?)\s*(kg|kilo|kilogram|g|gr|gram|grams)\s*$/);
  if (!match) return null;
  const number = Number(match[1]);
  if (!Number.isFinite(number) || number <= 0) return null;
  return Math.round(/^k/.test(match[2]) ? number * 1000 : number);
}

/** The shop's own spelling of a size: 45g, 150g, 1kg, 1.5kg. */
export function sizeLabel(grams: number): string {
  return grams >= 1000 && grams % 100 === 0 ? `${grams / 1000}kg` : `${grams}g`;
}

/** Grams for a size already in the catalogue, however it was typed. */
function catalogueGrams(size: string): number | null {
  return sizeGrams(size) ?? sizeGrams(size.replace(/\s.*$/, ""));
}

/** "58,000", "203000", "Rp 82.500", "82.5k" -> rupiah; null when empty or not a price. */
export function parsePrice(cell: string): number | null {
  const text = cell.trim().toLowerCase().replace(/^rp\.?\s*/, "");
  if (!text) return null;
  const k = text.match(/^(\d+(?:[.,]\d+)?)\s*(k|rb|ribu)$/);
  if (k) return Math.round(Number(k[1].replace(",", ".")) * 1000);
  // Thousands separators either way round (58,000 / 58.000); no decimals in rupiah.
  if (!/^\d{1,3}([.,]\d{3})*$|^\d+$/.test(text)) return null;
  const value = Number(text.replace(/[.,]/g, ""));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Read the pasted text. Needs the header row with the sizes in it; returns a
 * message instead of rows when it cannot find one.
 */
export function parsePriceList(text: string): { rows: PriceListRow[]; error?: string } {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.split("\t"))
    .filter((cells) => cells.some((cell) => cell.trim()));

  const headerIndex = lines.findIndex(
    (cells) => cells.filter((cell) => sizeGrams(cell) !== null).length >= 2,
  );
  if (headerIndex < 0) {
    return {
      rows: [],
      error:
        "Could not find the row with the sizes (15gr, 45gr, 1KG…). Copy it along with the coffees — select from the header row down.",
    };
  }

  const header = lines[headerIndex];
  const sizeColumns = header
    .map((cell, index) => ({ index, grams: sizeGrams(cell) }))
    .filter((column): column is { index: number; grams: number } => column.grams !== null);
  const firstSizeColumn = sizeColumns[0].index;

  const rows: PriceListRow[] = [];
  let region = "";

  for (const cells of lines.slice(headerIndex + 1)) {
    // The name is the last filled cell before the price columns (the sheet may
    // have a blank or numbered column in front).
    const name = cells
      .slice(0, firstSizeColumn)
      .map((cell) => cell.trim())
      .filter(Boolean)
      .at(-1);
    if (!name) continue;

    const sizes: PriceListSize[] = [];
    for (const column of sizeColumns) {
      const price = parsePrice(cells[column.index] ?? "");
      if (price !== null) {
        sizes.push({ size: sizeLabel(column.grams), grams: column.grams, price });
      }
    }

    if (!sizes.length) {
      region = name;
      continue;
    }
    rows.push({ name, region, sizes });
  }

  if (!rows.length) {
    return { rows, error: "Found the sizes, but no coffees with prices under them." };
  }
  return { rows };
}

// ---------------------------------------------------------------------------
// Against the catalogue
// ---------------------------------------------------------------------------

export interface PlanCatalogueProduct {
  id: string;
  name: string;
  is_active: boolean;
  product_variants: { id: string; size: string; price_idr: number; is_active: boolean }[];
}

export type SizeChange =
  | { kind: "same"; size: string; price: number }
  | { kind: "price"; size: string; price: number; was: number; variantId: string }
  | { kind: "back_on_sale"; size: string; price: number; variantId: string }
  | { kind: "new"; size: string; price: number };

export interface PlanItem {
  row: PriceListRow;
  /** The coffee this row updates, or null for a new one. */
  productId: string | null;
  changes: SizeChange[];
  /** Sizes the coffee sells that are not on the list. */
  notListed: { variantId: string; size: string }[];
}

/** Names compared ignoring case, spacing and punctuation. */
export function nameKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

export function planItem(
  row: PriceListRow,
  product: PlanCatalogueProduct | null,
): PlanItem {
  if (!product) {
    return {
      row,
      productId: null,
      changes: row.sizes.map((size) => ({ kind: "new", size: size.size, price: size.price })),
      notListed: [],
    };
  }

  const variants = product.product_variants.map((variant) => ({
    ...variant,
    grams: catalogueGrams(variant.size),
  }));

  const changes: SizeChange[] = row.sizes.map((size) => {
    const variant = variants.find((item) => item.grams === size.grams);
    if (!variant) return { kind: "new", size: size.size, price: size.price };
    if (variant.price_idr !== size.price) {
      return { kind: "price", size: variant.size, price: size.price, was: variant.price_idr, variantId: variant.id };
    }
    if (!variant.is_active) {
      return { kind: "back_on_sale", size: variant.size, price: size.price, variantId: variant.id };
    }
    return { kind: "same", size: variant.size, price: size.price };
  });

  const listed = new Set(row.sizes.map((size) => size.grams));
  const notListed = variants
    .filter((variant) => variant.is_active && (variant.grams === null || !listed.has(variant.grams)))
    .map((variant) => ({ variantId: variant.id, size: variant.size }));

  return { row, productId: product.id, changes, notListed };
}

/** Match every row to a coffee by name, exactly (ignoring case and punctuation). */
export function planPriceList(
  rows: PriceListRow[],
  catalogue: PlanCatalogueProduct[],
): { items: PlanItem[]; missing: PlanCatalogueProduct[] } {
  const byKey = new Map(catalogue.map((product) => [nameKey(product.name), product]));
  const items = rows.map((row) => planItem(row, byKey.get(nameKey(row.name)) ?? null));
  const used = new Set(items.map((item) => item.productId).filter(Boolean));
  const missing = catalogue.filter((product) => product.is_active && !used.has(product.id));
  return { items, missing };
}

/**
 * A likely existing coffee for a row whose name did not match exactly --
 * "Aceh G1 Washed Arabica" on the list, "Aceh G1 Washed" in the shop. Only a
 * suggestion, shown for the operator to accept; null unless exactly one coffee
 * is a clear candidate.
 */
export function suggestMatch(
  rowName: string,
  candidates: PlanCatalogueProduct[],
): PlanCatalogueProduct | null {
  const key = nameKey(rowName);
  const words = (name: string) =>
    new Set(
      name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .split(/[^a-z0-9]+/)
        .filter((word) => word.length >= 2),
    );
  const rowWords = words(rowName);

  const likely = candidates.filter((product) => {
    const other = nameKey(product.name);
    if (other.length >= 6 && (key.includes(other) || other.includes(key))) return true;
    const productWords = words(product.name);
    const shared = [...rowWords].filter((word) => productWords.has(word)).length;
    const union = new Set([...rowWords, ...productWords]).size;
    return union > 0 && shared / union >= 0.6;
  });
  return likely.length === 1 ? likely[0] : null;
}
