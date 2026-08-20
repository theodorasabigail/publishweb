"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { SUGGESTED_SIZES, type ProductVariant } from "@/lib/types";

interface Row {
  /** Stable across re-orders and removals, so React does not reuse the wrong
   *  input when a row in the middle is deleted. */
  key: string;
  size: string;
  price: string;
  stock: string;
  weight: string;
  active: boolean;
}

/** A sensible packed weight for a size the operator has just typed, so the
 *  shipping figure is roughly right before they touch it. Packaging adds
 *  30g on a small bag and about 10% on a large one. */
function guessWeight(size: string): string {
  const match = size.match(/([\d.]+)\s*(kg|g|gr|gram|oz)?/i);
  if (!match) return "";

  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return "";

  const unit = (match[2] ?? "g").toLowerCase();
  const grams =
    unit === "kg" ? value * 1000 : unit === "oz" ? value * 28.35 : value;

  return String(Math.round(grams + Math.max(30, grams * 0.1)));
}

const blankRow = (): Row => ({
  key: crypto.randomUUID(),
  size: "",
  price: "0",
  stock: "0",
  weight: "",
  active: true,
});

/**
 * Pack sizes, prices and stock.
 *
 * Was a fixed table of three rows, because the database only allowed 100g,
 * 200g and 1kg. Adding a 250g bag meant a code change, which is the wrong
 * place for a decision that changes with the lot and the season.
 *
 * Rows are submitted as an indexed set with a count alongside, rather than one
 * field per known size, so the server reads back however many were entered.
 */
export function VariantEditor({ variants }: { variants?: ProductVariant[] }) {
  const [rows, setRows] = useState<Row[]>(() => {
    const existing = (variants ?? [])
      .slice()
      .sort((a, b) => a.weight_grams - b.weight_grams)
      .map((variant) => ({
        key: variant.id,
        size: variant.size,
        price: String(variant.price_idr),
        stock: String(variant.stock),
        weight: String(variant.weight_grams),
        active: variant.is_active,
      }));

    if (existing.length) return existing;
    // A new product starts on the two sizes almost every roastery sells,
    // which is a starting point rather than a limit.
    return [
      { ...blankRow(), size: "200g", weight: "240" },
      { ...blankRow(), size: "1kg", weight: "1100" },
    ];
  });

  const update = (key: string, patch: Partial<Row>) =>
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );

  return (
    <div>
      <input type="hidden" name="variant_count" value={rows.length} />

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-sea-800">
            <tr>
              <th className="pb-2 pr-4 font-medium">Size</th>
              <th className="pb-2 pr-4 font-medium">Price (Rp)</th>
              <th className="pb-2 pr-4 font-medium">Stock (bags)</th>
              <th className="pb-2 pr-4 font-medium">Shipping weight (g)</th>
              <th className="pb-2 pr-4 font-medium">On sale</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-sea-200">
            {rows.map((row, index) => (
              <tr key={row.key}>
                <td className="py-3 pr-4">
                  <input
                    name={`variant_size_${index}`}
                    className="input w-32"
                    list="size-suggestions"
                    placeholder="250g"
                    value={row.size}
                    onChange={(event) => {
                      const size = event.target.value;
                      // Only fill a weight the operator has not set, so their
                      // own number is never overwritten as they keep typing.
                      const weight = row.weight || guessWeight(size);
                      update(row.key, { size, weight });
                    }}
                  />
                </td>
                <td className="py-3 pr-4">
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    name={`variant_price_${index}`}
                    className="input w-32"
                    value={row.price}
                    onChange={(e) => update(row.key, { price: e.target.value })}
                  />
                </td>
                <td className="py-3 pr-4">
                  <input
                    type="number"
                    min="0"
                    name={`variant_stock_${index}`}
                    className="input w-24"
                    value={row.stock}
                    onChange={(e) => update(row.key, { stock: e.target.value })}
                  />
                </td>
                <td className="py-3 pr-4">
                  <input
                    type="number"
                    min="1"
                    name={`variant_weight_${index}`}
                    className="input w-24"
                    placeholder="240"
                    value={row.weight}
                    onChange={(e) => update(row.key, { weight: e.target.value })}
                  />
                </td>
                <td className="py-3 pr-4">
                  <input
                    type="checkbox"
                    name={`variant_active_${index}`}
                    checked={row.active}
                    onChange={(e) => update(row.key, { active: e.target.checked })}
                    className="h-4 w-4 rounded border-sea-300"
                  />
                </td>
                <td className="py-3">
                  <button
                    type="button"
                    onClick={() =>
                      setRows((current) => current.filter((r) => r.key !== row.key))
                    }
                    // Removing the last row would leave a product with nothing
                    // to buy and no way to add a size back.
                    disabled={rows.length === 1}
                    className="rounded-lg p-2 text-sea-800 hover:bg-red-50 hover:text-red-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-sea-800"
                    aria-label={`Remove ${row.size || "this size"}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <datalist id="size-suggestions">
        {SUGGESTED_SIZES.map((size) => (
          <option key={size} value={size} />
        ))}
      </datalist>

      <button
        type="button"
        onClick={() => setRows((current) => [...current, blankRow()])}
        className="btn-secondary mt-4 py-2 text-xs"
      >
        <Plus className="h-4 w-4" /> Add a size
      </button>

      <p className="mt-4 text-xs text-sea-800">
        Type any size you like — <strong>250g</strong>, <strong>500g</strong>,{" "}
        <strong>12oz</strong>, <strong>Sample</strong>. Customers see it exactly
        as you write it, and sizes are listed smallest first by weight. Stock
        comes down by itself when an order is paid for; you only top it up here
        after a roast.
      </p>
      <p className="mt-2 text-xs text-sea-800">
        Shipping weight is the packed weight — the coffee plus the bag — and it
        is what couriers are asked to price, so it is worth getting roughly
        right.
      </p>
    </div>
  );
}
