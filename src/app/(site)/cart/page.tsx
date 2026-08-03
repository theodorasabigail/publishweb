"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useCart } from "@/components/cart-provider";
import { EmptyState } from "@/components/empty-state";
import { formatIDR } from "@/lib/utils";

export default function CartPage() {
  const { lines, subtotal, count, ready, setQuantity, remove } = useCart();

  if (!ready) {
    return <div className="container-page py-20 text-bark-500">Loading your cart…</div>;
  }

  if (!lines.length) {
    return (
      <div className="container-page py-14">
        <h1 className="mb-8 text-4xl">Your cart</h1>
        <EmptyState
          title="Nothing in the cart yet"
          description="Pick a coffee and a size, and it will show up here."
          actionLabel="Browse the roast list"
          actionHref="/shop"
        />
      </div>
    );
  }

  return (
    <div className="container-page py-14">
      <h1 className="text-4xl">Your cart</h1>
      <p className="mt-2 text-bark-600">
        {count} {count === 1 ? "bag" : "bags"}
      </p>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_360px]">
        <ul className="divide-y divide-bark-200/70 border-y border-bark-200/70">
          {lines.map((line) => (
            <li key={line.variantId} className="flex gap-4 py-5">
              <div
                className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl"
                style={{ backgroundColor: line.accentColor }}
              >
                {line.imageUrl && (
                  <Image
                    src={line.imageUrl}
                    alt={line.name}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                )}
              </div>

              <div className="flex flex-1 flex-col">
                <div className="flex justify-between gap-4">
                  <div>
                    <Link
                      href={`/shop/${line.slug}`}
                      className="font-medium hover:underline"
                    >
                      {line.name}
                    </Link>
                    <p className="mt-0.5 text-sm text-bark-500">{line.size}</p>
                  </div>
                  <p className="font-medium">{formatIDR(line.priceIdr * line.quantity)}</p>
                </div>

                <div className="mt-auto flex items-center justify-between pt-3">
                  <div className="flex items-center rounded-full border border-bark-200">
                    <button
                      type="button"
                      onClick={() => setQuantity(line.variantId, line.quantity - 1)}
                      className="p-2"
                      aria-label={`Decrease quantity of ${line.name}`}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm">{line.quantity}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity(line.variantId, line.quantity + 1)}
                      className="p-2"
                      aria-label={`Increase quantity of ${line.name}`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => remove(line.variantId)}
                    className="flex items-center gap-1.5 text-sm text-bark-500 hover:text-red-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="h-fit card p-6">
          <h2 className="text-xl">Summary</h2>
          <dl className="mt-5 space-y-2.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-bark-600">Subtotal</dt>
              <dd className="font-medium">{formatIDR(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-bark-600">Shipping</dt>
              <dd className="text-bark-500">Calculated at checkout</dd>
            </div>
          </dl>

          <Link href="/checkout" className="btn-primary mt-6 w-full">
            Checkout
          </Link>
          <Link href="/shop" className="btn-ghost mt-2 w-full">
            Keep shopping
          </Link>
        </aside>
      </div>
    </div>
  );
}
