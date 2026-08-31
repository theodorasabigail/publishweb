"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, GripVertical, Search, Star } from "lucide-react";
import { reorderProducts } from "@/app/admin/_actions/products";
import { BulkBar, SavedFlash } from "@/components/admin/bulk-bar";
import { StockEditor } from "@/components/admin/stock-editor";
import { FLAVOUR_SWATCH_RING, flavourFor, productColour } from "@/lib/flavour";
import type { Category, ProductWithVariants } from "@/lib/types";
import { cn, formatIDR } from "@/lib/utils";

/**
 * The product list, and the reorder control from the presentation knobs
 * (spec §7.2). Rows can be dragged, and the same move is available on the
 * arrow buttons so this works on a phone and with a keyboard.
 */
export function ProductList({
  products,
  categories = [],
}: {
  products: ProductWithVariants[];
  categories?: Category[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(products);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [show, setShow] = useState<"all" | "live" | "hidden" | "out">("all");
  const [flash, setFlash] = useState<string | null>(null);
  // Which rows have the stock editor open. Keyed by product id so opening
  // one and paging away then back keeps state simple (a page nav re-mounts
  // this component and clears the set, which is the correct default).
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpanded(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // What is on screen after the search box and the status tabs. Reordering is
  // disabled while this is narrowed, because dragging row 3 above row 1 in a
  // filtered view has no defensible meaning for the rows you cannot see.
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((product) => {
      // Availability, not shelf count: a bag held by an unpaid manual order
      // cannot be sold, which is what this filter is asking about.
      const available = (product.product_variants ?? []).reduce(
        (sum, v) => sum + v.available,
        0,
      );
      if (show === "live" && !product.is_active) return false;
      if (show === "hidden" && product.is_active) return false;
      if (show === "out" && available > 0) return false;
      if (!needle) return true;
      return [product.name, product.origin, product.process, product.varietal, product.categories?.name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [items, query, show]);

  const narrowed = filtered.length !== items.length;
  const allShown = filtered.length > 0 && filtered.every((p) => selected.includes(p.id));

  function toggleOne(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }

  function toggleAllShown() {
    const ids = filtered.map((p) => p.id);
    setSelected(allShown ? selected.filter((id) => !ids.includes(id)) : [...new Set([...selected, ...ids])]);
  }

  function afterBulk(message: string) {
    setFlash(message);
    // The server is the truth about what changed; re-reading it is cheaper to
    // reason about than patching a dozen fields locally and hoping they match.
    router.refresh();
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    setItems(next);
    setDirty(true);
    setSaved(false);
  }

  function saveOrder() {
    startTransition(async () => {
      await reorderProducts(items.map((item, index) => ({ id: item.id, sort_order: index })));
      setDirty(false);
      setSaved(true);
    });
  }

  return (
    <div>
      {flash && <SavedFlash message={flash} />}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sea-700" />
          <input
            className="input pl-9"
            placeholder="Search coffees…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setFlash(null);
            }}
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {([
            ["all", "All"],
            ["live", "Live"],
            ["hidden", "Hidden"],
            ["out", "Out of stock"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setShow(value)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                show === value ? "bg-sea-900 text-cream" : "text-sea-800 hover:bg-sea-100",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <label className="mb-3 flex items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={allShown}
          onChange={toggleAllShown}
          className="h-4 w-4 rounded border-sea-400"
        />
        <span className="text-sea-800">
          Select all {narrowed ? `${filtered.length} shown` : ""}
        </span>
      </label>

      {(dirty || saved) && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-sea-300 bg-sea-50 px-4 py-3 text-sm">
          <span>
            {dirty
              ? "You changed the order of the shop."
              : "Order saved — the shop now shows this order."}
          </span>
          {dirty && (
            <button
              type="button"
              onClick={saveOrder}
              disabled={pending}
              className="btn-primary py-1.5 text-xs"
            >
              {pending ? "Saving…" : "Save order"}
            </button>
          )}
        </div>
      )}

      <ul className="divide-y divide-sea-200 rounded-xl border border-sea-200 bg-white">
        {filtered.map((product) => {
          const index = items.indexOf(product);
          const flavour = flavourFor(product.flavour_level);
          const isSelected = selected.includes(product.id);
          const prices = (product.product_variants ?? []).map((v) => v.price_idr);
          const stock = (product.product_variants ?? []).reduce(
            (sum, v) => sum + v.stock,
            0,
          );
          const held = (product.product_variants ?? []).reduce(
            (sum, v) => sum + v.reserved,
            0,
          );

          const isExpanded = expanded.has(product.id);
          const variants = product.product_variants ?? [];

          return (
            <li
              key={product.id}
              draggable={!narrowed}
              onDragStart={() => setDragIndex(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (dragIndex !== null) move(dragIndex, index);
                setDragIndex(null);
              }}
              className={cn(
                dragIndex === index && "opacity-50",
                isSelected && "bg-sea-50",
              )}
            >
              <div className="flex items-center gap-3 px-4 py-3">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleOne(product.id)}
                className="h-4 w-4 shrink-0 rounded border-sea-400"
                aria-label={`Select ${product.name}`}
              />

              <GripVertical
                className={cn(
                  "h-4 w-4 shrink-0 text-sea-800",
                  narrowed ? "opacity-25" : "cursor-grab",
                )}
              />

              <button
                type="button"
                onClick={() => toggleExpanded(product.id)}
                aria-label={isExpanded ? `Collapse ${product.name}` : `Expand ${product.name} to edit stock`}
                aria-expanded={isExpanded}
                className="shrink-0 rounded p-0.5 text-sea-800 hover:bg-sea-100"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>

              {/* The flavour colour itself, not a separate accent with a dot
                  on it. One colour system, and it is the one on the bag. */}
              <span
                className="h-9 w-9 shrink-0 rounded-lg"
                style={{ backgroundColor: productColour(product), border: FLAVOUR_SWATCH_RING }}
                title={flavour ? flavour.label : "No flavour colour set"}
                aria-hidden
              />

              <div className="min-w-0 flex-1">
                <Link
                  href={`/admin/products/${product.id}`}
                  className="truncate font-medium hover:underline"
                >
                  {product.name}
                </Link>
                <p className="truncate text-xs text-sea-800">
                  {product.categories?.name ?? "Uncategorised"} ·{" "}
                  {prices.length ? `from ${formatIDR(Math.min(...prices))}` : "no price set"}
                </p>
              </div>

              <div className="hidden shrink-0 text-right sm:block">
                <p
                  className={cn(
                    "text-sm font-medium",
                    stock === 0 ? "text-red-700" : stock <= 5 ? "text-amber-700" : "",
                  )}
                >
                  {stock} in stock
                </p>
                {held > 0 && (
                  <p
                    className="text-xs text-amber-700"
                    title="Held by orders that are agreed but not yet paid."
                  >
                    {held} held · {stock - held} free
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {product.is_featured && (
                  <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
                )}
                <span
                  className={cn(
                    "badge",
                    product.is_active
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-sea-100 text-sea-800",
                  )}
                >
                  {product.is_active ? "Live" : "Hidden"}
                </span>
              </div>

              <div className="flex shrink-0 flex-col">
                <button
                  type="button"
                  onClick={() => move(index, index - 1)}
                  disabled={index === 0}
                  className="rounded p-0.5 text-sea-800 hover:bg-sea-100 disabled:opacity-30"
                  aria-label={`Move ${product.name} up`}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, index + 1)}
                  disabled={index === items.length - 1}
                  className="rounded p-0.5 text-sea-800 hover:bg-sea-100 disabled:opacity-30"
                  aria-label={`Move ${product.name} down`}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>
              </div>

              {isExpanded && <StockEditor variants={variants} />}
            </li>
          );
        })}
      </ul>

      {selected.length > 0 && (
        <BulkBar
          selected={selected}
          categories={categories}
          onDone={afterBulk}
          onClear={() => setSelected([])}
        />
      )}
    </div>
  );
}
