"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Check,
  Minus,
  Package,
  Plus,
  Search,
  Store,
  Tag,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import {
  customerAddresses,
  findCustomers,
  recordManualOrder,
  type ManualAddress,
  type PosPaymentMethod,
} from "@/app/admin/_actions/pos";
import {
  CHANNEL_LABELS,
  CHANNEL_REFERENCE_LABELS,
  MANUAL_CHANNELS,
  type SalesChannel,
} from "@/lib/types";
import type { ProductWithVariants } from "@/lib/types";
import { productColour } from "@/lib/flavour";
import { cn, formatIDR } from "@/lib/utils";

/**
 * The till, and everything that is nearly the till.
 *
 * Two modes on one screen, because they are the same job done at different
 * speeds. A counter sale is optimised for one-handed use: tap a size to add
 * it, tap again to add another, nothing confirmed twice, the total always the
 * largest thing on screen. A manual order — WhatsApp, Instagram, a marketplace
 * — is the same basket with the three things a chat order has and a counter
 * sale does not: where it came from, whether the money has arrived yet, and
 * where it has to go.
 *
 * They share the product grid and the basket deliberately. The muscle memory
 * for finding a coffee is the valuable part, and it should not change because
 * the customer happened to message rather than walk in.
 */

type Mode = "counter" | "manual";

interface Line {
  variantId: string;
  productName: string;
  size: string;
  /** What this line is being charged at — the catalogue price until somebody
   *  types over it. */
  priceIdr: number;
  /** What the catalogue says, kept so an override can be shown as a change
   *  from something rather than as a number with no context. */
  cataloguePriceIdr: number;
  available: number;
  quantity: number;
}

interface Customer {
  id: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  loyalty_points: number;
  tier: string;
}

interface SavedAddress extends ManualAddress {
  id: string;
  is_default: boolean;
}

/** Notes Ebi is likely to have in the drawer, for one-tap cash tendering. */
const CASH_PRESETS = [50_000, 100_000, 150_000, 200_000, 500_000];

const BLANK_ADDRESS: ManualAddress = {
  recipient_name: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  province: "",
  postal_code: "",
  country: "ID",
  email: "",
};

export function PosTerminal({
  products,
  rupiahPerPoint,
}: {
  products: ProductWithVariants[];
  rupiahPerPoint: number;
}) {
  const [mode, setMode] = useState<Mode>("counter");
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [method, setMethod] = useState<PosPaymentMethod>("cash");
  const [cashReceived, setCashReceived] = useState<number | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);

  // Manual-order-only state.
  const [channel, setChannel] = useState<SalesChannel>("whatsapp");
  const [channelReference, setChannelReference] = useState("");
  const [markPaid, setMarkPaid] = useState(false);
  const [ships, setShips] = useState(false);
  const [address, setAddress] = useState<ManualAddress>(BLANK_ADDRESS);
  // Keyed by whose addresses they are, so switching customer can never show
  // the previous one's addresses for a frame.
  const [saved, setSaved] = useState<{ userId: string; rows: SavedAddress[] }>({
    userId: "",
    rows: [],
  });
  const [shippingIdr, setShippingIdr] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [customPricing, setCustomPricing] = useState(false);
  const [discountIdr, setDiscountIdr] = useState<number | null>(null);
  const [discountReason, setDiscountReason] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{
    ref: string;
    total: number;
    change: number | null;
    points: number;
    paid: boolean;
    ships: boolean;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  const isManual = mode === "manual";
  const paid = isManual ? markPaid : true;
  const shipping = isManual && ships ? (shippingIdr ?? 0) : 0;

  const subtotal = lines.reduce((sum, line) => sum + line.priceIdr * line.quantity, 0);
  // Capped at the subtotal: taking off more than the coffee costs would make
  // this a refund, which is not something an order can record.
  const discount = Math.min(Math.max(0, discountIdr ?? 0), subtotal);
  const total = subtotal - discount + shipping;
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

  // Addresses the shop already has for this customer. Only worth fetching once
  // there is somewhere to put them.
  useEffect(() => {
    if (!customer || !isManual || !ships) return;
    const userId = customer.id;
    let live = true;
    customerAddresses(userId).then((rows) => {
      if (live) setSaved({ userId, rows: rows as SavedAddress[] });
    });
    return () => {
      live = false;
    };
  }, [customer, isManual, ships]);

  // Derived rather than cleared in the effect: there is one source of truth for
  // "whose addresses are these", and no render where it disagrees with itself.
  const savedAddresses =
    customer && isManual && ships && saved.userId === customer.id ? saved.rows : [];

  function addVariant(product: ProductWithVariants, variantId: string) {
    const variant = product.product_variants.find((item) => item.id === variantId);
    if (!variant) return;

    setError(null);
    setLines((current) => {
      const existing = current.find((line) => line.variantId === variantId);
      if (existing) {
        // Never let the till build a basket the stock cannot cover.
        if (existing.quantity >= variant.available) {
          setError(
            `Only ${variant.available} of ${product.name} (${variant.size}) available.`,
          );
          return current;
        }
        return current.map((line) =>
          line.variantId === variantId
            ? { ...line, quantity: line.quantity + 1 }
            : line,
        );
      }

      if (variant.available < 1) {
        setError(`${product.name} (${variant.size}) is not available.`);
        return current;
      }

      return [
        ...current,
        {
          variantId,
          productName: product.name,
          size: variant.size,
          priceIdr: variant.price_idr,
          cataloguePriceIdr: variant.price_idr,
          available: variant.available,
          quantity: 1,
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
              ? { ...line, quantity: Math.min(quantity, line.available) }
              : line,
          ),
    );
  }

  /** A price agreed for this order only. The catalogue is never touched. */
  function setPrice(variantId: string, priceIdr: number) {
    setLines((current) =>
      current.map((line) =>
        line.variantId === variantId
          ? { ...line, priceIdr: Math.max(0, Math.round(priceIdr || 0)) }
          : line,
      ),
    );
  }

  function resetSale() {
    setLines([]);
    setCashReceived(null);
    setCustomer(null);
    setMethod("cash");
    setChannelReference("");
    setMarkPaid(false);
    setShips(false);
    setAddress(BLANK_ADDRESS);
    setShippingIdr(null);
    setNote("");
    setCustomPricing(false);
    setDiscountIdr(null);
    setDiscountReason("");
    setError(null);
    setReceipt(null);
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    // A counter sale is always paid on the spot; a chat order usually is not.
    setMarkPaid(next === "counter");
    if (next === "counter") {
      setShips(false);
      setShippingIdr(null);
    }
  }

  function searchCustomers(value: string) {
    setCustomerQuery(value);
    startTransition(async () => {
      setCustomerResults(await findCustomers(value));
    });
  }

  function applySavedAddress(row: SavedAddress) {
    setAddress({
      recipient_name: row.recipient_name,
      phone: row.phone,
      line1: row.line1,
      line2: row.line2 ?? "",
      city: row.city,
      province: row.province ?? "",
      postal_code: row.postal_code ?? "",
      country: row.country,
      email: customer?.email ?? "",
    });
  }

  /** What is stopping this order being saved, in the words the operator needs. */
  const blocker = useMemo(() => {
    if (!lines.length) return "Add something to the order first.";
    if (paid && method === "cash" && cashReceived !== null && cashReceived < total) {
      return "Cash received is less than the total.";
    }
    if (lines.some((line) => !Number.isFinite(line.priceIdr) || line.priceIdr < 0)) {
      return "A price cannot be negative.";
    }
    if (discount > 0 && !discountReason.trim()) {
      return "Say what the discount is for.";
    }
    if (isManual && ships) {
      if (!address.recipient_name.trim()) return "A parcel needs a name to go to.";
      if (!address.phone.trim()) return "The courier will need a phone number.";
      if (!address.line1.trim()) return "Add a street address.";
      if (!address.city.trim()) return "Add a city.";
    }
    return null;
  }, [lines, paid, method, cashReceived, total, isManual, ships, address, discount, discountReason]);

  function submit() {
    setError(null);
    if (blocker) {
      setError(blocker);
      return;
    }

    startTransition(async () => {
      const result = await recordManualOrder({
        lines: lines.map((line) => ({
          variantId: line.variantId,
          quantity: line.quantity,
          // Only sent when it actually differs, so an untouched line is priced
          // by the database exactly as it always was.
          unitPriceIdr:
            line.priceIdr === line.cataloguePriceIdr ? null : line.priceIdr,
        })),
        channel: isManual ? channel : "pos",
        paymentMethod: paid ? method : null,
        markPaid: paid,
        cashReceived: paid && method === "cash" ? cashReceived : null,
        customerId: customer?.id ?? null,
        note: note || null,
        channelReference: isManual ? channelReference : null,
        address: isManual && ships ? address : null,
        shippingIdr: isManual && ships ? (shippingIdr ?? 0) : 0,
        discountIdr: discount,
        discountReason: discount > 0 ? discountReason : null,
      });

      if (!result.ok || !result.order) {
        setError(result.error ?? "Could not save the order.");
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
        paid: Boolean(result.order.paid_at),
        ships: isManual && ships,
      });
      setLines([]);
      setCashReceived(null);
      setCustomer(null);
      setChannelReference("");
      setAddress(BLANK_ADDRESS);
      setShippingIdr(null);
      setNote("");
      setCustomPricing(false);
      setDiscountIdr(null);
      setDiscountReason("");
    });
  }

  // ---- Order saved -------------------------------------------------------
  if (receipt) {
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <Check className="h-8 w-8 text-emerald-700" />
        </div>
        <h2 className="mt-5 font-serif text-3xl">
          {receipt.paid ? "Sale complete" : "Order saved"}
        </h2>
        <p className="mt-1 text-sm text-sea-800">{receipt.ref}</p>

        {receipt.change !== null && receipt.change > 0 && (
          <div className="mt-8 rounded-2xl border-2 border-sea-800 p-6">
            <p className="text-sm uppercase tracking-wider text-sea-800">Change due</p>
            <p className="mt-1 font-serif text-5xl">{formatIDR(receipt.change)}</p>
          </div>
        )}

        <dl className="mt-6 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-sea-800">Total</dt>
            <dd className="font-medium">{formatIDR(receipt.total)}</dd>
          </div>
          {receipt.points > 0 && (
            <div className="flex justify-between">
              <dt className="text-sea-800">Points earned</dt>
              <dd className="font-medium text-emerald-700">+{receipt.points}</dd>
            </div>
          )}
        </dl>

        {!receipt.paid && (
          <p className="mt-6 rounded-lg bg-amber-50 p-3 text-left text-xs text-amber-900">
            The coffee is <strong>held for this order</strong> and will not be
            offered on the website. Mark it paid on the order page when the money
            arrives — or cancel it, which puts the coffee back on the shelf.
          </p>
        )}
        {receipt.paid && receipt.ships && (
          <p className="mt-6 rounded-lg bg-sea-50 p-3 text-left text-xs text-sea-800">
            Paid, and waiting to be packed. It is in <strong>Orders</strong> with
            the website ones — add a tracking number there when it goes out.
          </p>
        )}

        <button
          type="button"
          onClick={resetSale}
          className="btn-primary mt-8 w-full py-3 text-base"
          autoFocus
        >
          Next order
        </button>
      </div>
    );
  }

  // ---- Till --------------------------------------------------------------
  return (
    <div>
      <nav className="mb-4 inline-flex rounded-full border border-sea-200 bg-white p-1">
        {(
          [
            ["counter", "Counter sale"],
            ["manual", "Manual order"],
          ] as [Mode, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => switchMode(value)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm transition-colors",
              mode === value
                ? "bg-sea-800 text-cream"
                : "text-sea-800 hover:bg-sea-50",
            )}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="grid gap-5 lg:grid-cols-[1fr_380px] lg:items-start">
        {/* Product picker */}
        <div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sea-800" />
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
                className="overflow-hidden rounded-xl border border-sea-200 bg-white"
              >
                <div
                  className="px-3 py-2"
                  style={{ backgroundColor: `${productColour(product)}1a` }}
                >
                  <p className="truncate text-sm font-medium">{product.name}</p>
                  {product.origin && (
                    <p className="truncate text-xs text-sea-800">{product.origin}</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5 p-2">
                  {product.product_variants.map((variant) => {
                    const soldOut = variant.available < 1;
                    const held = variant.reserved > 0;
                    return (
                      <button
                        key={variant.id}
                        type="button"
                        disabled={soldOut}
                        onClick={() => addVariant(product, variant.id)}
                        className={cn(
                          "flex-1 rounded-lg border px-2 py-2 text-center transition-colors",
                          soldOut
                            ? "cursor-not-allowed border-sea-200 opacity-40"
                            : "border-sea-200 hover:border-sea-700 hover:bg-sea-50 active:bg-sea-100",
                        )}
                      >
                        <span className="block text-sm font-medium">{variant.size}</span>
                        <span className="block text-xs text-sea-800">
                          {formatIDR(variant.price_idr)}
                        </span>
                        <span
                          className={cn(
                            "mt-0.5 block text-[10px]",
                            variant.available <= 3 ? "text-amber-700" : "text-sea-800",
                          )}
                        >
                          {soldOut ? "none free" : `${variant.available} left`}
                        </span>
                        {held && (
                          <span className="block text-[10px] text-sea-800/70">
                            {variant.reserved} held
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {!visibleProducts.length && (
            <p className="mt-8 text-center text-sm text-sea-800">
              Nothing matches “{query}”.
            </p>
          )}
        </div>

        {/* Basket */}
        <aside className="rounded-xl border border-sea-200 bg-white lg:sticky lg:top-6">
          <div className="flex items-center justify-between border-b border-sea-200 px-4 py-3">
            <h2 className="font-medium">{isManual ? "This order" : "This sale"}</h2>
            {lines.length > 0 && (
              <button
                type="button"
                onClick={resetSale}
                className="flex items-center gap-1 text-xs text-sea-800 hover:text-red-700"
              >
                <Trash2 className="h-3.5 w-3.5" /> Clear
              </button>
            )}
          </div>

          {lines.length ? (
            <ul className="divide-y divide-sea-200">
              {lines.map((line) => (
                <li key={line.variantId} className="flex items-center gap-2 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{line.productName}</p>
                    {customPricing ? (
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="text-xs text-sea-800">{line.size}</span>
                        <input
                          type="number"
                          min={0}
                          step={1000}
                          value={line.priceIdr}
                          onChange={(event) =>
                            setPrice(line.variantId, Number(event.target.value))
                          }
                          className="input h-7 w-24 px-1.5 py-0 text-xs"
                          aria-label={`Price each for ${line.productName}`}
                        />
                        {line.priceIdr !== line.cataloguePriceIdr && (
                          <button
                            type="button"
                            onClick={() =>
                              setPrice(line.variantId, line.cataloguePriceIdr)
                            }
                            className="text-[10px] text-sea-800 underline"
                            title={`Catalogue price is ${formatIDR(line.cataloguePriceIdr)}`}
                          >
                            reset
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-sea-800">
                        {line.size} · {formatIDR(line.priceIdr)}
                        {line.priceIdr !== line.cataloguePriceIdr && (
                          <span className="ml-1 text-amber-700">(agreed)</span>
                        )}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center rounded-full border border-sea-200">
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
                      disabled={line.quantity >= line.available}
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
            <p className="px-4 py-10 text-center text-sm text-sea-800">
              Tap a size to start.
            </p>
          )}

          {/* Where it came from */}
          {isManual && (
            <div className="space-y-3 border-t border-sea-200 px-4 py-3">
              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-wider text-sea-800">
                  Came in through
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {MANUAL_CHANNELS.filter((option) => option !== "pos").map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setChannel(option)}
                      className={cn(
                        "rounded-lg border py-1.5 text-xs transition-colors",
                        channel === option
                          ? "border-sea-800 bg-sea-800 text-cream"
                          : "border-sea-200 hover:border-sea-400",
                      )}
                    >
                      {CHANNEL_LABELS[option]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="channel-reference"
                  className="mb-1 block text-xs text-sea-800"
                >
                  {CHANNEL_REFERENCE_LABELS[channel] ?? "Reference"}
                </label>
                <input
                  id="channel-reference"
                  value={channelReference}
                  onChange={(event) => setChannelReference(event.target.value)}
                  placeholder={
                    channel === "whatsapp"
                      ? "0812…"
                      : channel === "instagram"
                        ? "@handle"
                        : "So you can find the conversation again"
                  }
                  className="input text-sm"
                />
              </div>
            </div>
          )}

          {/* Customer */}
          <div className="border-t border-sea-200 px-4 py-3">
            {customer ? (
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {customer.display_name || customer.email}
                  </p>
                  <p className="text-xs text-sea-800">
                    {customer.loyalty_points} points · {customer.tier}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCustomer(null)}
                  className="rounded p-1 text-sea-800 hover:bg-sea-100"
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
                  <ul className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-sea-200">
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
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-sea-50"
                        >
                          {found.display_name || found.email}
                          <span className="block text-xs text-sea-800">
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
                  className="mt-2 text-xs text-sea-800 hover:underline"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowCustomerSearch(true)}
                className="flex items-center gap-1.5 text-sm text-sea-800 hover:text-sea-900"
              >
                <UserPlus className="h-4 w-4" /> Add customer for points
              </button>
            )}
          </div>

          {/* Where it is going */}
          {isManual && (
            <div className="border-t border-sea-200 px-4 py-3">
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setShips(false)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs transition-colors",
                    !ships
                      ? "border-sea-800 bg-sea-800 text-cream"
                      : "border-sea-200 hover:border-sea-400",
                  )}
                >
                  <Store className="h-3.5 w-3.5" /> Collecting
                </button>
                <button
                  type="button"
                  onClick={() => setShips(true)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs transition-colors",
                    ships
                      ? "border-sea-800 bg-sea-800 text-cream"
                      : "border-sea-200 hover:border-sea-400",
                  )}
                >
                  <Package className="h-3.5 w-3.5" /> Shipping
                </button>
              </div>

              {ships && (
                <div className="mt-3 space-y-2">
                  {savedAddresses.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs text-sea-800">
                        Addresses you already have
                      </p>
                      <div className="space-y-1">
                        {savedAddresses.map((row) => (
                          <button
                            key={row.id}
                            type="button"
                            onClick={() => applySavedAddress(row)}
                            className="block w-full rounded-lg border border-sea-200 px-2 py-1.5 text-left text-xs hover:border-sea-400 hover:bg-sea-50"
                          >
                            <span className="font-medium">{row.recipient_name}</span>
                            <span className="block text-sea-800">
                              {row.line1}, {row.city}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <AddressFields value={address} onChange={setAddress} />

                  <div>
                    <label
                      htmlFor="manual-shipping"
                      className="mb-1 block text-xs text-sea-800"
                    >
                      Shipping to charge
                    </label>
                    <input
                      id="manual-shipping"
                      type="number"
                      min={0}
                      step={1000}
                      value={shippingIdr ?? ""}
                      onChange={(event) =>
                        setShippingIdr(
                          event.target.value ? Number(event.target.value) : null,
                        )
                      }
                      placeholder="0"
                      className="input text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Note */}
          {isManual && (
            <div className="border-t border-sea-200 px-4 py-3">
              <label htmlFor="manual-note" className="mb-1 block text-xs text-sea-800">
                Note
              </label>
              <textarea
                id="manual-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={2}
                placeholder="Anything worth remembering about this one"
                className="input text-sm"
              />
            </div>
          )}

          {/* Bulk prices and discounts */}
          {lines.length > 0 && (
            <div className="border-t border-sea-200 px-4 py-3">
              <button
                type="button"
                onClick={() => setCustomPricing((on) => !on)}
                className="flex items-center gap-1.5 text-sm text-sea-800 hover:text-sea-900"
              >
                <Tag className="h-4 w-4" />
                {customPricing ? "Use catalogue prices" : "Custom price or discount"}
              </button>

              {customPricing && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-sea-800">
                    Type over a price above for a bulk or wholesale rate. It
                    applies to this order only — the shop price does not change.
                  </p>
                  <div>
                    <label
                      htmlFor="order-discount"
                      className="mb-1 block text-xs text-sea-800"
                    >
                      Discount off the coffee
                    </label>
                    <input
                      id="order-discount"
                      type="number"
                      min={0}
                      step={1000}
                      value={discountIdr ?? ""}
                      onChange={(event) =>
                        setDiscountIdr(
                          event.target.value ? Number(event.target.value) : null,
                        )
                      }
                      placeholder="0"
                      className="input text-sm"
                    />
                  </div>
                  {discount > 0 && (
                    <div>
                      <label
                        htmlFor="discount-reason"
                        className="mb-1 block text-xs text-sea-800"
                      >
                        What for?
                      </label>
                      <input
                        id="discount-reason"
                        value={discountReason}
                        onChange={(event) => setDiscountReason(event.target.value)}
                        placeholder="Regular customer, 5kg order…"
                        className="input text-sm"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Total + payment */}
          <div className="border-t border-sea-200 px-4 py-4">
            {(shipping > 0 || discount > 0) && (
              <dl className="mb-2 space-y-1 text-xs text-sea-800">
                <div className="flex justify-between">
                  <dt>Coffee</dt>
                  <dd>{formatIDR(subtotal)}</dd>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <dt>Discount</dt>
                    <dd>−{formatIDR(discount)}</dd>
                  </div>
                )}
                {shipping > 0 && (
                  <div className="flex justify-between">
                    <dt>Shipping</dt>
                    <dd>{formatIDR(shipping)}</dd>
                  </div>
                )}
              </dl>
            )}

            <div className="flex items-baseline justify-between">
              <span className="text-sm text-sea-800">Total</span>
              <span className="font-serif text-3xl">{formatIDR(total)}</span>
            </div>

            {customer && total > 0 && paid && (
              <p className="mt-1 text-right text-xs text-emerald-700">
                earns {Math.floor(total / Math.max(1, rupiahPerPoint))} points
              </p>
            )}

            {isManual && (
              <div className="mt-4 grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setMarkPaid(false)}
                  className={cn(
                    "rounded-lg border py-2 text-xs transition-colors",
                    !markPaid
                      ? "border-amber-500 bg-amber-50 text-amber-900"
                      : "border-sea-200 hover:border-sea-400",
                  )}
                >
                  Not paid yet
                </button>
                <button
                  type="button"
                  onClick={() => setMarkPaid(true)}
                  className={cn(
                    "rounded-lg border py-2 text-xs transition-colors",
                    markPaid
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-sea-200 hover:border-sea-400",
                  )}
                >
                  Already paid
                </button>
              </div>
            )}

            {paid && (
              <div className="mt-3 grid grid-cols-4 gap-1.5">
                {(["cash", "qris", "card", "transfer"] as PosPaymentMethod[]).map(
                  (option) => (
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
                          ? "border-sea-800 bg-sea-800 text-cream"
                          : "border-sea-200 hover:border-sea-400",
                      )}
                    >
                      {option}
                    </button>
                  ),
                )}
              </div>
            )}

            {paid && method === "cash" && (
              <div className="mt-3">
                <div className="flex flex-wrap gap-1.5">
                  {CASH_PRESETS.filter((note) => note >= total)
                    .slice(0, 3)
                    .map((note) => (
                      <button
                        key={note}
                        type="button"
                        onClick={() => setCashReceived(note)}
                        className={cn(
                          "flex-1 rounded-lg border py-1.5 text-xs",
                          cashReceived === note
                            ? "border-sea-800 bg-sea-100"
                            : "border-sea-200 hover:border-sea-400",
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
                          ? "border-sea-800 bg-sea-100"
                          : "border-sea-200 hover:border-sea-400",
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
                      change < 0 ? "text-red-700" : "text-sea-700",
                    )}
                  >
                    {change < 0
                      ? `${formatIDR(Math.abs(change))} short`
                      : `Change ${formatIDR(change)}`}
                  </p>
                )}
              </div>
            )}

            {isManual && !markPaid && lines.length > 0 && (
              <p className="mt-3 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900">
                This holds the coffee off the website until it is paid or
                cancelled.
              </p>
            )}

            {error && (
              <p className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs text-red-800" role="alert">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={pending || Boolean(blocker)}
              className="btn-primary mt-4 w-full py-3 text-base"
            >
              {pending
                ? "Saving…"
                : paid
                  ? `Take ${formatIDR(total)}`
                  : `Save order · ${formatIDR(total)}`}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

/**
 * The address a parcel goes to.
 *
 * Deliberately the same fields, in the same order, as the storefront checkout
 * form — an order typed here and an order placed on the site produce the same
 * shipping snapshot, so everything downstream (the courier, the shipped email,
 * the customer's order page) cannot tell them apart.
 */
function AddressFields({
  value,
  onChange,
}: {
  value: ManualAddress;
  onChange: (next: ManualAddress) => void;
}) {
  function set(field: keyof ManualAddress, next: string) {
    onChange({ ...value, [field]: next });
  }

  return (
    <div className="space-y-2">
      <input
        value={value.recipient_name}
        onChange={(event) => set("recipient_name", event.target.value)}
        placeholder="Name"
        className="input text-sm"
        aria-label="Recipient name"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          value={value.phone}
          onChange={(event) => set("phone", event.target.value)}
          placeholder="Phone"
          className="input text-sm"
          aria-label="Phone"
        />
        <input
          value={value.email ?? ""}
          onChange={(event) => set("email", event.target.value)}
          placeholder="Email (optional)"
          className="input text-sm"
          aria-label="Email"
        />
      </div>
      <input
        value={value.line1}
        onChange={(event) => set("line1", event.target.value)}
        placeholder="Street address"
        className="input text-sm"
        aria-label="Street address"
      />
      <input
        value={value.line2 ?? ""}
        onChange={(event) => set("line2", event.target.value)}
        placeholder="Apartment, RT/RW (optional)"
        className="input text-sm"
        aria-label="Address line 2"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          value={value.city}
          onChange={(event) => set("city", event.target.value)}
          placeholder="City"
          className="input text-sm"
          aria-label="City"
        />
        <input
          value={value.province ?? ""}
          onChange={(event) => set("province", event.target.value)}
          placeholder="Province"
          className="input text-sm"
          aria-label="Province"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          value={value.postal_code ?? ""}
          onChange={(event) => set("postal_code", event.target.value)}
          placeholder="Postcode"
          className="input text-sm"
          aria-label="Postcode"
        />
        <input
          value={value.country}
          onChange={(event) => set("country", event.target.value)}
          placeholder="Country"
          className="input text-sm"
          aria-label="Country"
        />
      </div>
    </div>
  );
}
