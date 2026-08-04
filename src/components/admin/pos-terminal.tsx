"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Minus, Plus, Search, Trash2, UserPlus, X } from "lucide-react";
import { findCustomers, recordSale } from "@/app/admin/_actions/pos";
import type { ProductWithVariants } from "@/lib/types";
import { cn, formatIDR } from "@/lib/utils";

/**
 * The till.
 *
 * Optimised for one-handed use at a counter: tap a size to add it, tap again
 * to add another. Nothing is confirmed twice, nothing needs a keyboard, and
 * the total is always the largest thing on screen.
 */

type PaymentMethod = "cash" | "qris" | "card" | "transfer";

interface Line {
  variantId: string;
  productName: string;
  size: string;
  priceIdr: number;
  stock: number;
  quantity: number;
  accentColor: string;
}

interface Customer {
  id: string;
  display_name: string | null;
  email: string | null;
  loyalty_points: number;
  tier: string;
}

/** Notes Ebi is likely to have in the drawer, for one-tap cash tendering. */
const CASH_PRESETS = [50_000, 100_000, 150_000, 200_000, 500_000];

export function PosTerminal({
  products,
  rupiahPerPoint,
}: {
  products: ProductWithVariants[];
  rupiahPerPoint: number;
}) {
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [cashReceived, setCashReceived] = useState<number | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{
    ref: string;
    total: number;
    change: number | null;
    points: number;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  const total = lines.reduce((sum, line) => sum + line.priceIdr * line.quantity, 0);
  const change = cashReceived !== null ? cashReceived - total : null;

  const visibleProducts = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return products;
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(term) ||
        (product.origin ?? "").toLowerCase().includes(term) ||
        (product.tasting_notes ?? "").toLowerCase().includes(term),
    );
  }, [products, query]);

  function addVariant(product: ProductWithVariants, variantId: string) {
    const variant = product.product_variants.find((item) => item.id === variantId);
    if (!variant) return;

    setError(null);
    setLines((current) => {
      const existing = current.find((line) => line.variantId === variantId);
      if (existing) {
        // Never let the till build a basket the stock cannot cover.
        if (existing.quantity >= variant.stock) {
          setError(`Only ${variant.stock} of ${product.name} (${variant.size}) in stock.`);
          return current;
        }
        return current.map((line) =>
          line.variantId === variantId
            ? { ...line, quantity: line.quantity + 1 }
            : line,
        );
      }

      if (variant.stock < 1) {
        setError(`${product.name} (${variant.size}) is out of stock.`);
        return current;
      }

      return [
        ...current,
        {
          variantId,
          productName: product.name,
          size: variant.size,
          priceIdr: variant.price_idr,
          stock: variant.stock,
          quantity: 1,
          accentColor: product.accent_color,
        },
      ];
    });
  }

  function setQuantity(variantId: string, quantity: number) {
    setLines((current) =>
      quantity <= 0
        ? current.filter((line) => line.variantId !== variantId)
        : current.map((line) =>
            line.variantId === variantId
              ? { ...line, quantity: Math.min(quantity, line.stock) }
              : line,
          ),
    );
  }

  function resetSale() {
    setLines([]);
    setCashReceived(null);
    setCustomer(null);
    setMethod("cash");
    setError(null);
    setReceipt(null);
  }

  function searchCustomers(value: string) {
    setCustomerQuery(value);
    startTransition(async () => {
      setCustomerResults(await findCustomers(value));
    });
  }

  function completeSale() {
    setError(null);
    startTransition(async () => {
      const result = await recordSale({
        lines: lines.map((line) => ({
          variantId: line.variantId,
          quantity: line.quantity,
        })),
        paymentMethod: method,
        cashReceived: method === "cash" ? cashReceived : null,
        customerId: customer?.id ?? null,
      });

      if (!result.ok || !result.order) {
        setError(result.error ?? "Could not complete the sale.");
        return;
      }

      setReceipt({
        ref: result.order.human_ref,
        total: result.order.total_idr,
        change:
          result.order.cash_received_idr !== null
            ? result.order.cash_received_idr - result.order.total_idr
            : null,
        points: result.order.points_awarded,
      });
      setLines([]);
      setCashReceived(null);
      setCustomer(null);
    });
  }

  // ---- Sale complete -----------------------------------------------------
  if (receipt) {
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <Check className="h-8 w-8 text-emerald-700" />
        </div>
        <h2 className="mt-5 font-serif text-3xl">Sale complete</h2>
        <p className="mt-1 text-sm text-bark-500">{receipt.ref}</p>

        {receipt.change !== null && receipt.change > 0 && (
          <div className="mt-8 rounded-2xl border-2 border-bark-800 p-6">
            <p className="text-sm uppercase tracking-wider text-bark-600">
              Change due
            </p>
            <p className="mt-1 font-serif text-5xl">{formatIDR(receipt.change)}</p>
          </div>
        )}

        <dl className="mt-6 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-bark-600">Total</dt>
            <dd className="font-medium">{formatIDR(receipt.total)}</dd>
          </div>
          {receipt.points > 0 && (
            <div className="flex justify-between">
              <dt className="text-bark-600">Points earned</dt>
              <dd className="font-medium text-emerald-700">+{receipt.points}</dd>
            </div>
          )}
        </dl>

        <button
          type="button"
          onClick={resetSale}
          className="btn-primary mt-8 w-full py-3 text-base"
          autoFocus
        >
          Next sale
        </button>
      </div>
    );
  }

  // ---- Till --------------------------------------------------------------
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_380px] lg:items-start">
      {/* Product picker */}
      <div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bark-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search coffee…"
            className="input pl-9"
            aria-label="Search coffee"
          />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibleProducts.map((product) => (
            <div
              key={product.id}
              className="overflow-hidden rounded-xl border border-bark-200 bg-white"
            >
              <div
                className="px-3 py-2"
                style={{ backgroundColor: `${product.accent_color}1a` }}
              >
                <p className="truncate text-sm font-medium">{product.name}</p>
                {product.origin && (
                  <p className="truncate text-xs text-bark-500">{product.origin}</p>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5 p-2">
                {product.product_variants.map((variant) => {
                  const soldOut = variant.stock < 1;
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      disabled={soldOut}
                      onClick={() => addVariant(product, variant.id)}
                      className={cn(
                        "flex-1 rounded-lg border px-2 py-2 text-center transition-colors",
                        soldOut
                          ? "cursor-not-allowed border-bark-200 opacity-40"
                          : "border-bark-200 hover:border-bark-700 hover:bg-bark-50 active:bg-bark-100",
                      )}
                    >
                      <span className="block text-sm font-medium">{variant.size}</span>
                      <span className="block text-xs text-bark-500">
                        {formatIDR(variant.price_idr)}
                      </span>
                      <span
                        className={cn(
                          "mt-0.5 block text-[10px]",
                          variant.stock <= 3 ? "text-amber-700" : "text-bark-400",
                        )}
                      >
                        {soldOut ? "sold out" : `${variant.stock} left`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {!visibleProducts.length && (
          <p className="mt-8 text-center text-sm text-bark-500">
            Nothing matches “{query}”.
          </p>
        )}
      </div>

      {/* Basket */}
      <aside className="rounded-xl border border-bark-200 bg-white lg:sticky lg:top-6">
        <div className="flex items-center justify-between border-b border-bark-200 px-4 py-3">
          <h2 className="font-medium">This sale</h2>
          {lines.length > 0 && (
            <button
              type="button"
              onClick={resetSale}
              className="flex items-center gap-1 text-xs text-bark-500 hover:text-red-700"
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>

        {lines.length ? (
          <ul className="divide-y divide-bark-200">
            {lines.map((line) => (
              <li key={line.variantId} className="flex items-center gap-2 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{line.productName}</p>
                  <p className="text-xs text-bark-500">
                    {line.size} · {formatIDR(line.priceIdr)}
                  </p>
                </div>

                <div className="flex items-center rounded-full border border-bark-200">
                  <button
                    type="button"
                    onClick={() => setQuantity(line.variantId, line.quantity - 1)}
                    className="p-1.5"
                    aria-label={`One fewer ${line.productName}`}
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-6 text-center text-sm">{line.quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(line.variantId, line.quantity + 1)}
                    disabled={line.quantity >= line.stock}
                    className="p-1.5 disabled:opacity-30"
                    aria-label={`One more ${line.productName}`}
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>

                <span className="w-20 shrink-0 text-right text-sm font-medium">
                  {formatIDR(line.priceIdr * line.quantity)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-10 text-center text-sm text-bark-500">
            Tap a size to start a sale.
          </p>
        )}

        {/* Customer */}
        <div className="border-t border-bark-200 px-4 py-3">
          {customer ? (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {customer.display_name || customer.email}
                </p>
                <p className="text-xs text-bark-500">
                  {customer.loyalty_points} points · {customer.tier}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCustomer(null)}
                className="rounded p-1 text-bark-500 hover:bg-bark-100"
                aria-label="Remove customer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : showCustomerSearch ? (
            <div>
              <input
                autoFocus
                value={customerQuery}
                onChange={(event) => searchCustomers(event.target.value)}
                placeholder="Name or email…"
                className="input text-sm"
                aria-label="Find a customer"
              />
              {customerResults.length > 0 && (
                <ul className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-bark-200">
                  {customerResults.map((found) => (
                    <li key={found.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomer(found);
                          setShowCustomerSearch(false);
                          setCustomerQuery("");
                          setCustomerResults([]);
                        }}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-bark-50"
                      >
                        {found.display_name || found.email}
                        <span className="block text-xs text-bark-500">
                          {found.loyalty_points} points
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                onClick={() => setShowCustomerSearch(false)}
                className="mt-2 text-xs text-bark-500 hover:underline"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCustomerSearch(true)}
              className="flex items-center gap-1.5 text-sm text-bark-600 hover:text-bark-900"
            >
              <UserPlus className="h-4 w-4" /> Add customer for points
            </button>
          )}
        </div>

        {/* Total + payment */}
        <div className="border-t border-bark-200 px-4 py-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-bark-600">Total</span>
            <span className="font-serif text-3xl">{formatIDR(total)}</span>
          </div>

          {customer && total > 0 && (
            <p className="mt-1 text-right text-xs text-emerald-700">
              earns {Math.floor(total / Math.max(1, rupiahPerPoint))} points
            </p>
          )}

          <div className="mt-4 grid grid-cols-4 gap-1.5">
            {(["cash", "qris", "card", "transfer"] as PaymentMethod[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setMethod(option);
                  if (option !== "cash") setCashReceived(null);
                }}
                className={cn(
                  "rounded-lg border py-2 text-xs capitalize transition-colors",
                  method === option
                    ? "border-bark-800 bg-bark-800 text-cream"
                    : "border-bark-200 hover:border-bark-400",
                )}
              >
                {option}
              </button>
            ))}
          </div>

          {method === "cash" && (
            <div className="mt-3">
              <div className="flex flex-wrap gap-1.5">
                {CASH_PRESETS.filter((note) => note >= total).slice(0, 3).map((note) => (
                  <button
                    key={note}
                    type="button"
                    onClick={() => setCashReceived(note)}
                    className={cn(
                      "flex-1 rounded-lg border py-1.5 text-xs",
                      cashReceived === note
                        ? "border-bark-800 bg-bark-100"
                        : "border-bark-200 hover:border-bark-400",
                    )}
                  >
                    {formatIDR(note)}
                  </button>
                ))}
                {total > 0 && (
                  <button
                    type="button"
                    onClick={() => setCashReceived(total)}
                    className={cn(
                      "flex-1 rounded-lg border py-1.5 text-xs",
                      cashReceived === total
                        ? "border-bark-800 bg-bark-100"
                        : "border-bark-200 hover:border-bark-400",
                    )}
                  >
                    Exact
                  </button>
                )}
              </div>

              <input
                type="number"
                min={0}
                step={1000}
                value={cashReceived ?? ""}
                onChange={(event) =>
                  setCashReceived(event.target.value ? Number(event.target.value) : null)
                }
                placeholder="Cash received"
                className="input mt-2 text-sm"
                aria-label="Cash received"
              />

              {change !== null && (
                <p
                  className={cn(
                    "mt-2 text-right text-sm",
                    change < 0 ? "text-red-700" : "text-bark-700",
                  )}
                >
                  {change < 0
                    ? `${formatIDR(Math.abs(change))} short`
                    : `Change ${formatIDR(change)}`}
                </p>
              )}
            </div>
          )}

          {error && (
            <p className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs text-red-800" role="alert">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={completeSale}
            disabled={
              pending ||
              !lines.length ||
              (method === "cash" && cashReceived !== null && cashReceived < total)
            }
            className="btn-primary mt-4 w-full py-3 text-base"
          >
            {pending ? "Recording…" : `Take ${formatIDR(total)}`}
          </button>
        </div>
      </aside>
    </div>
  );
}
