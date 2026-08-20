"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, GripVertical, Star } from "lucide-react";
import { reorderProducts } from "@/app/admin/_actions/products";
import type { ProductWithVariants } from "@/lib/types";
import { cn, formatIDR } from "@/lib/utils";

/**
 * The product list, and the reorder control from the presentation knobs
 * (spec §7.2). Rows can be dragged, and the same move is available on the
 * arrow buttons so this works on a phone and with a keyboard.
 */
export function ProductList({ products }: { products: ProductWithVariants[] }) {
  const [items, setItems] = useState(products);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

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
      {(dirty || saved) && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-bark-300 bg-bark-50 px-4 py-3 text-sm">
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

      <ul className="divide-y divide-bark-200 rounded-xl border border-bark-200 bg-white">
        {items.map((product, index) => {
          const prices = (product.product_variants ?? []).map((v) => v.price_idr);
          const stock = (product.product_variants ?? []).reduce(
            (sum, v) => sum + v.stock,
            0,
          );

          return (
            <li
              key={product.id}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (dragIndex !== null) move(dragIndex, index);
                setDragIndex(null);
              }}
              className={cn(
                "flex items-center gap-3 px-4 py-3",
                dragIndex === index && "opacity-50",
              )}
            >
              <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-bark-600" />

              <span
                className="h-9 w-9 shrink-0 rounded-lg"
                style={{ backgroundColor: product.accent_color }}
                aria-hidden
              />

              <div className="min-w-0 flex-1">
                <Link
                  href={`/admin/products/${product.id}`}
                  className="truncate font-medium hover:underline"
                >
                  {product.name}
                </Link>
                <p className="truncate text-xs text-bark-600">
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
                      : "bg-bark-100 text-bark-600",
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
                  className="rounded p-0.5 text-bark-600 hover:bg-bark-100 disabled:opacity-30"
                  aria-label={`Move ${product.name} up`}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, index + 1)}
                  disabled={index === items.length - 1}
                  className="rounded p-0.5 text-bark-600 hover:bg-bark-100 disabled:opacity-30"
                  aria-label={`Move ${product.name} down`}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
