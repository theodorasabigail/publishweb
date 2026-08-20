"use client";

import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { ProductCard } from "@/components/shop/product-card";
import { EmptyState } from "@/components/empty-state";
import {
  FLAVOUR_LEVELS,
  FLAVOUR_SWATCH_RING,
  flavourFor,
} from "@/lib/flavour";
import type { Category, ProductWithVariants } from "@/lib/types";
import { cn } from "@/lib/utils";

type Sort =
  | "featured"
  | "flavour-asc"
  | "flavour-desc"
  | "price-asc"
  | "price-desc"
  | "name"
  | "newest";

const SORTS: { value: Sort; label: string }[] = [
  { value: "featured", label: "Our order" },
  { value: "flavour-asc", label: "Lightest first" },
  { value: "flavour-desc", label: "Boldest first" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "name", label: "Name A–Z" },
  { value: "newest", label: "Newest first" },
];

/** Cheapest size on sale, which is what the card shows as "from". */
function fromPrice(product: ProductWithVariants): number | null {
  const prices = (product.product_variants ?? []).map((v) => v.price_idr);
  return prices.length ? Math.min(...prices) : null;
}

function inStock(product: ProductWithVariants): boolean {
  return (product.product_variants ?? []).some((v) => v.stock > 0);
}

/**
 * Browsing the roast list.
 *
 * Filtering happens in the browser rather than on the server, which is a
 * deliberate trade. /shop is a cached page — it currently serves without
 * touching the database at all — and moving filters into the URL would make it
 * render per request, so every tick of a checkbox would cost a query. Sending
 * the whole list once and filtering it locally keeps that, and makes every
 * filter instant instead of a page load.
 *
 * That trade holds while the list is tens of coffees. At several hundred it
 * inverts and this should move to the server with the results paginated.
 */
export function ShopBrowser({
  products,
  categories,
}: {
  products: ProductWithVariants[];
  categories: Category[];
}) {
  const [query, setQuery] = useState("");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [origins, setOrigins] = useState<string[]>([]);
  const [flavours, setFlavours] = useState<number[]>([]);
  const [stockOnly, setStockOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("featured");
  const [railOpen, setRailOpen] = useState(false);

  // Origins come from the coffees themselves rather than from a table: they
  // are a fact about each lot, and a list nobody has to maintain cannot fall
  // out of step with what is actually on the shelf.
  const allOrigins = useMemo(() => {
    const seen = new Map<string, number>();
    for (const product of products) {
      const origin = product.origin?.trim();
      if (origin) seen.set(origin, (seen.get(origin) ?? 0) + 1);
    }
    return [...seen.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [products]);

  // Only the levels actually on the shelf. A scale with three empty swatches
  // makes a small lineup look like a gap rather than a selection.
  const usedFlavours = useMemo(() => {
    return FLAVOUR_LEVELS.map((entry) => ({
      entry,
      count: products.filter((p) => p.flavour_level === entry.level).length,
    })).filter((row) => row.count > 0);
  }, [products]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    const matches = products.filter((product) => {
      if (categoryIds.length && !categoryIds.includes(product.category_id ?? "")) {
        return false;
      }
      if (origins.length && !origins.includes(product.origin?.trim() ?? "")) {
        return false;
      }
      if (flavours.length && !flavours.includes(product.flavour_level ?? -1)) {
        return false;
      }
      if (stockOnly && !inStock(product)) return false;

      if (!needle) return true;
      // Everything a person might reasonably type: the name, where it is from,
      // how it was processed, the varietal, how it tastes, and the pack sizes.
      const haystack = [
        product.name,
        product.origin,
        product.process,
        product.varietal,
        product.roast_level,
        product.tasting_notes,
        product.description,
        ...(product.product_variants ?? []).map((v) => v.size),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });

    const sorted = [...matches];
    switch (sort) {
      case "price-asc":
      case "price-desc": {
        // A coffee with no price at all sorts last either way, rather than
        // leading a "cheapest first" list at zero.
        const direction = sort === "price-asc" ? 1 : -1;
        sorted.sort((a, b) => {
          const x = fromPrice(a);
          const y = fromPrice(b);
          if (x === null) return 1;
          if (y === null) return -1;
          return (x - y) * direction;
        });
        break;
      }
      case "flavour-asc":
      case "flavour-desc": {
        // Unassigned coffees sort to the end either way rather than pretending
        // to be level 0, which would put them at the head of "lightest first".
        const direction = sort === "flavour-asc" ? 1 : -1;
        sorted.sort((a, b) => {
          const x = a.flavour_level;
          const y = b.flavour_level;
          if (!x) return 1;
          if (!y) return -1;
          return (x - y) * direction;
        });
        break;
      }
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "newest":
        sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
        break;
      default:
        break; // Already in the operator's own order from the server.
    }
    return sorted;
  }, [products, query, categoryIds, origins, flavours, stockOnly, sort]);

  const activeCount =
    categoryIds.length +
    origins.length +
    flavours.length +
    (stockOnly ? 1 : 0) +
    (query ? 1 : 0);

  const toggle = (
    value: string,
    list: string[],
    set: (next: string[]) => void,
  ) => set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  function clearAll() {
    setQuery("");
    setCategoryIds([]);
    setOrigins([]);
    setFlavours([]);
    setStockOnly(false);
  }

  return (
    <div className="mt-8 lg:flex lg:gap-10">
      {/* Filters */}
      <div className="lg:w-56 lg:shrink-0">
        <button
          type="button"
          onClick={() => setRailOpen((open) => !open)}
          className="btn-secondary w-full lg:hidden"
          aria-expanded={railOpen}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters{activeCount ? ` (${activeCount})` : ""}
        </button>

        <div
          className={cn(
            "mt-4 space-y-7 lg:mt-0 lg:block",
            railOpen ? "block" : "hidden",
          )}
        >
          <div>
            <label className="label" htmlFor="shop-search">
              Search
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sea-700" />
              <input
                id="shop-search"
                type="search"
                className="input pl-9"
                placeholder="Origin, process, notes…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>

          {usedFlavours.length > 0 && (
            <FilterGroup title="Flavour">
              <p className="mb-3 text-xs leading-relaxed text-sea-800">
                Our colour scale. Pale is clean and delicate, deep is big and
                sweet, purple is the heavily processed lots.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {usedFlavours.map(({ entry, count }) => {
                  const on = flavours.includes(entry.level);
                  return (
                    <button
                      key={entry.level}
                      type="button"
                      onClick={() =>
                        setFlavours(
                          on
                            ? flavours.filter((l) => l !== entry.level)
                            : [...flavours, entry.level],
                        )
                      }
                      aria-pressed={on}
                      title={`${entry.label} — ${entry.description} (${count})`}
                      className={cn(
                        "h-8 w-8 rounded-full transition-transform hover:scale-110",
                        on && "ring-2 ring-ink ring-offset-2",
                      )}
                      style={{
                        backgroundColor: entry.hex,
                        border: FLAVOUR_SWATCH_RING,
                      }}
                    >
                      <span className="sr-only">
                        {entry.label}: {entry.description}
                      </span>
                    </button>
                  );
                })}
              </div>
              {flavours.length > 0 && (
                <p className="mt-2.5 text-xs text-sea-800">
                  {flavours
                    .slice()
                    .sort((a, b) => a - b)
                    .map((level) => flavourFor(level)?.label)
                    .filter(Boolean)
                    .join(", ")}
                </p>
              )}
            </FilterGroup>
          )}

          {allOrigins.length > 1 && (
            <FilterGroup title="Origin">
              {allOrigins.map(([origin, count]) => (
                <CheckRow
                  key={origin}
                  label={origin}
                  count={count}
                  checked={origins.includes(origin)}
                  onChange={() => toggle(origin, origins, setOrigins)}
                />
              ))}
            </FilterGroup>
          )}

          {categories.length > 0 && (
            <FilterGroup title="Category">
              {categories.map((category) => (
                <CheckRow
                  key={category.id}
                  label={category.name}
                  count={
                    products.filter((p) => p.category_id === category.id).length
                  }
                  checked={categoryIds.includes(category.id)}
                  onChange={() => toggle(category.id, categoryIds, setCategoryIds)}
                />
              ))}
            </FilterGroup>
          )}

          <FilterGroup title="Availability">
            <CheckRow
              label="In stock only"
              checked={stockOnly}
              onChange={() => setStockOnly((on) => !on)}
            />
          </FilterGroup>

          {activeCount > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="flex items-center gap-1.5 text-sm text-sea-800 underline underline-offset-4"
            >
              <X className="h-3.5 w-3.5" /> Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="mt-8 min-w-0 flex-1 lg:mt-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sea-200 pb-4">
          <p className="text-sm text-sea-800" role="status" aria-live="polite">
            {visible.length} {visible.length === 1 ? "coffee" : "coffees"}
            {activeCount > 0 && products.length !== visible.length
              ? ` of ${products.length}`
              : ""}
          </p>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-sea-800">Sort</span>
            <select
              className="input w-auto py-1.5"
              value={sort}
              onChange={(event) => setSort(event.target.value as Sort)}
            >
              {SORTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {visible.length ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="mt-8">
            <EmptyState
              title={
                products.length ? "Nothing matches that" : "Nothing listed yet"
              }
              description={
                products.length
                  ? "Try a different search, or clear the filters to see everything."
                  : "Products added in the admin dashboard show up here straight away."
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-sea-800">
        {title}
      </h2>
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

function CheckRow({
  label,
  count,
  checked,
  onChange,
}: {
  label: string;
  count?: number;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 shrink-0 rounded border-sea-400 text-sea-900 focus:ring-sea-700"
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && (
        <span className="text-xs text-sea-800">{count}</span>
      )}
    </label>
  );
}
