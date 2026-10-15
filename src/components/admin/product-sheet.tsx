"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Plus, Search } from "lucide-react";
import { StockCell, TextCell, ToggleCell } from "@/components/admin/edit-cells";
import {
  addVariant,
  quickAddProduct,
  updateProductField,
  updateVariantField,
  type ProductField,
  type VariantField,
} from "@/app/admin/_actions/quick-edit";
import type { ProductWithVariants } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Every coffee on one screen, editable like a spreadsheet.
 *
 * Each cell holds its own copy of the value while it is being edited, and is
 * keyed on the stored value, so a change made elsewhere (the "tell it what
 * changed" box, another tab) shows up here when the page refreshes.
 *
 * One row per size; the coffee's own columns (name, on the shop, tasting
 * notes, description) span its sizes. Each cell saves itself when you leave
 * it or press Enter -- there is no Save button to forget -- and shows what
 * happened right where you typed: a spinner, a tick, or what went wrong.
 *
 * Enter moves down the column, the way a spreadsheet does, so a recount after
 * a roast is: type, Enter, type, Enter.
 */

export function ProductSheet({ products }: { products: ProductWithVariants[] }) {
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) =>
      [product.name, product.origin, product.tasting_notes]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(term)),
    );
  }, [products, query]);

  return (
    <div>
      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sea-800" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find a coffee…"
          className="input pl-9"
          aria-label="Find a coffee"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-sea-200 bg-white">
        <table className="w-full min-w-[1080px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-sea-200 bg-sea-50 text-left text-xs text-sea-800">
              <th className="px-2 py-2 font-medium">Coffee</th>
              <th className="px-2 py-2 font-medium" title="Shown on the website">On shop</th>
              <th className="px-2 py-2 font-medium">Size</th>
              <th className="px-2 py-2 text-right font-medium">Price (Rp)</th>
              <th className="px-2 py-2 text-right font-medium">Stock</th>
              <th className="px-2 py-2 font-medium" title="This size can be bought">On sale</th>
              <th className="px-2 py-2 font-medium">Tasting notes</th>
              <th className="px-2 py-2 font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((product) => (
              <ProductRows key={product.id} product={product} />
            ))}
          </tbody>
        </table>
      </div>

      {!visible.length && (
        <p className="mt-6 text-center text-sm text-sea-800">
          {query ? `Nothing matches “${query}”.` : "No coffees yet — add one below."}
        </p>
      )}

      <AddCoffee />
    </div>
  );
}

function ProductRows({ product }: { product: ProductWithVariants }) {
  const variants = product.product_variants ?? [];
  const span = variants.length + 1; // + the "add a size" row
  const saveProduct = (field: ProductField) => (value: string | boolean) =>
    updateProductField(product.id, field, value);
  const saveVariant = (id: string, field: VariantField) => (value: string | boolean) =>
    updateVariantField(id, field, value);

  const productCells = (
    <>
      <td rowSpan={span} className="min-w-[180px] border-t border-sea-200 px-2 py-1.5 align-top">
        <TextCell key={product.name} col="name" value={product.name} onSave={saveProduct("name")} className="font-medium" />
        <Link
          href={`/admin/products/${product.id}`}
          className="mt-0.5 inline-flex items-center gap-1 px-1.5 text-[11px] text-sea-800 hover:underline"
        >
          Photo, details & SEO <ExternalLink className="h-3 w-3" />
        </Link>
      </td>
      <td rowSpan={span} className="border-t border-sea-200 px-2 py-1.5 align-top">
        <ToggleCell
          key={String(product.is_active)}
          value={product.is_active}
          onSave={saveProduct("is_active")}
          label={`${product.name} on the shop`}
        />
      </td>
    </>
  );

  const noteCells = (
    <>
      <td rowSpan={span} className="min-w-[200px] border-t border-sea-200 px-2 py-1.5 align-top">
        <TextCell
          key={product.tasting_notes ?? ""}
          col="tasting_notes"
          value={product.tasting_notes ?? ""}
          onSave={saveProduct("tasting_notes")}
          placeholder="Chocolate, plum…"
        />
      </td>
      <td rowSpan={span} className="min-w-[260px] border-t border-sea-200 px-2 py-1.5 align-top">
        <TextCell
          key={product.description ?? ""}
          col="description"
          value={product.description ?? ""}
          onSave={saveProduct("description")}
          multiline
          placeholder="What it is like, in a sentence or two"
        />
      </td>
    </>
  );

  return (
    <>
      {variants.map((variant, index) => (
        <tr key={variant.id} className={cn(!product.is_active && "bg-sea-50/40")}>
          {index === 0 && productCells}
          <td className={cn("px-2 py-1.5", index === 0 && "border-t border-sea-200")}>
            <TextCell key={variant.size} col="size" value={variant.size} onSave={saveVariant(variant.id, "size")} className="w-24" />
          </td>
          <td className={cn("px-2 py-1.5", index === 0 && "border-t border-sea-200")}>
            <TextCell
              key={variant.price_idr}
              col="price"
              value={String(variant.price_idr)}
              onSave={saveVariant(variant.id, "price_idr")}
              numeric
              className="w-28 text-right"
            />
          </td>
          <td className={cn("px-2 py-1.5", index === 0 && "border-t border-sea-200")}>
            <StockCell key={variant.stock} variantId={variant.id} stock={variant.stock} reserved={variant.reserved} />
          </td>
          <td className={cn("px-2 py-1.5", index === 0 && "border-t border-sea-200")}>
            <ToggleCell
              key={String(variant.is_active)}
              value={variant.is_active}
              onSave={saveVariant(variant.id, "is_active")}
              label={`${product.name} ${variant.size} on sale`}
            />
          </td>
          {index === 0 && noteCells}
        </tr>
      ))}
      <tr className={cn(!product.is_active && "bg-sea-50/40")}>
        {variants.length === 0 && productCells}
        <td
          colSpan={4}
          className={cn("px-2 pb-2 pt-1", variants.length === 0 && "border-t border-sea-200")}
        >
          <AddSize productId={product.id} />
        </td>
        {variants.length === 0 && noteCells}
      </tr>
    </>
  );
}

function AddSize({ productId }: { productId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const first = useRef<HTMLInputElement>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setTimeout(() => first.current?.focus(), 0);
        }}
        className="flex items-center gap-1 px-1.5 text-[11px] text-sea-800 hover:underline"
      >
        <Plus className="h-3 w-3" /> Add a size
      </button>
    );
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await addVariant(productId, {
        size,
        price: Number(price.replace(/\D/g, "")),
        stock: Number(stock.replace(/\D/g, "")),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setSize("");
      setPrice("");
      setStock("");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="flex flex-wrap items-center gap-1.5 px-1.5"
    >
      <input ref={first} value={size} onChange={(e) => setSize(e.target.value)} placeholder="Size, e.g. 500g" className="input h-8 w-28 py-0 text-xs" />
      <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price" inputMode="numeric" className="input h-8 w-24 py-0 text-xs" />
      <input value={stock} onChange={(e) => setStock(e.target.value)} placeholder="Stock" inputMode="numeric" className="input h-8 w-20 py-0 text-xs" />
      <button type="submit" disabled={pending || !size.trim()} className="rounded-md bg-sea-800 px-2.5 py-1.5 text-xs text-cream disabled:opacity-40">
        {pending ? "Adding…" : "Add"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-sea-800 hover:underline">
        Cancel
      </button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </form>
  );
}

function AddCoffee() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [size, setSize] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await quickAddProduct({
            name,
            size,
            price: Number(price.replace(/\D/g, "")),
            stock: Number(stock.replace(/\D/g, "")),
          });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setAdded(name.trim());
          setName("");
          setSize("");
          setPrice("");
          setStock("");
          router.refresh();
        });
      }}
      className="mt-4 rounded-xl border border-dashed border-sea-400 bg-white p-4"
    >
      <p className="mb-2 text-sm font-medium">Add a coffee</p>
      <div className="flex flex-wrap items-center gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. Toraja Sapan" className="input w-56 text-sm" aria-label="New coffee name" />
        <input value={size} onChange={(e) => setSize(e.target.value)} placeholder="First size, e.g. 250g" className="input w-36 text-sm" aria-label="First size" />
        <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price" inputMode="numeric" className="input w-28 text-sm" aria-label="Price" />
        <input value={stock} onChange={(e) => setStock(e.target.value)} placeholder="Stock" inputMode="numeric" className="input w-24 text-sm" aria-label="Stock" />
        <button type="submit" disabled={pending || !name.trim()} className="btn-primary py-2 text-sm">
          <Plus className="h-4 w-4" /> {pending ? "Adding…" : "Add"}
        </button>
      </div>
      <p className="mt-2 text-xs text-sea-800">
        It starts hidden from the shop. Fill in the notes in the sheet, then
        switch <strong>On shop</strong> on when it is ready.
      </p>
      {added && !error && (
        <p className="mt-2 text-xs text-emerald-700">Added {added}. It is in the sheet above.</p>
      )}
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </form>
  );
}
