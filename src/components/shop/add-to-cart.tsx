"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Minus, Plus } from "lucide-react";
import { useCart } from "@/components/cart-provider";
import type { ProductWithVariants, ProductVariant } from "@/lib/types";
import { cn, formatIDR } from "@/lib/utils";

export function AddToCart({ product }: { product: ProductWithVariants }) {
  const variants = product.product_variants ?? [];
  const firstAvailable = variants.find((variant) => variant.stock > 0) ?? variants[0];

  const [selectedId, setSelectedId] = useState<string | undefined>(firstAvailable?.id);
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const { add } = useCart();

  const selected: ProductVariant | undefined =
    variants.find((variant) => variant.id === selectedId) ?? firstAvailable;

  if (!selected) {
    return (
      <p className="rounded-xl bg-bark-100 p-4 text-sm text-bark-700">
        This coffee has no sizes listed right now. Check back soon.
      </p>
    );
  }

  const soldOut = selected.stock <= 0;
  const maxQuantity = Math.max(1, Math.min(selected.stock, 20));

  function onAdd() {
    if (!selected || soldOut) return;
    add({
      productId: product.id,
      variantId: selected.id,
      slug: product.slug,
      name: product.name,
      size: selected.size,
      priceIdr: selected.price_idr,
      weightGrams: selected.weight_grams,
      imageUrl: product.image_url,
      accentColor: product.accent_color,
      quantity,
    });
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 2500);
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="label">Size</p>
        <div className="flex flex-wrap gap-2">
          {variants.map((variant) => {
            const isSelected = variant.id === selected.id;
            const unavailable = variant.stock <= 0;
            return (
              <button
                key={variant.id}
                type="button"
                onClick={() => {
                  setSelectedId(variant.id);
                  setQuantity(1);
                }}
                className={cn(
                  "rounded-xl border px-4 py-2.5 text-left transition-colors",
                  isSelected
                    ? "border-bark-800 bg-bark-800 text-cream"
                    : "border-bark-200 bg-white hover:border-bark-400",
                  unavailable && "opacity-50",
                )}
              >
                <span className="block text-sm font-medium">{variant.size}</span>
                <span
                  className={cn(
                    "block text-xs",
                    isSelected ? "text-bark-200" : "text-bark-500",
                  )}
                >
                  {unavailable ? "Sold out" : formatIDR(variant.price_idr)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-baseline justify-between border-y border-bark-200/70 py-4">
        <span className="text-sm text-bark-600">Price</span>
        <span className="font-serif text-2xl">{formatIDR(selected.price_idr)}</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-full border border-bark-200">
          <button
            type="button"
            onClick={() => setQuantity((value) => Math.max(1, value - 1))}
            disabled={quantity <= 1}
            className="p-2.5 disabled:opacity-40"
            aria-label="Decrease quantity"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-9 text-center text-sm font-medium" aria-live="polite">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))}
            disabled={quantity >= maxQuantity}
            className="p-2.5 disabled:opacity-40"
            aria-label="Increase quantity"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={onAdd}
          disabled={soldOut}
          className="btn-primary flex-1 sm:flex-none sm:px-8"
        >
          {soldOut ? "Sold out" : justAdded ? "Added to cart" : "Add to cart"}
        </button>
      </div>

      {justAdded && (
        <p className="flex items-center gap-2 text-sm text-bark-700" role="status">
          <Check className="h-4 w-4" />
          <Link href="/cart" className="underline underline-offset-4">
            Go to cart
          </Link>
        </p>
      )}

      {!soldOut && selected.stock <= 5 && (
        <p className="text-sm text-amber-700">
          Only {selected.stock} left in this size.
        </p>
      )}
    </div>
  );
}
