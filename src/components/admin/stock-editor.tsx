"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { updateVariantStock } from "@/app/admin/_actions/products";
import { cn, formatIDR } from "@/lib/utils";
import type { ProductVariant } from "@/lib/types";

/**
 * Inline per-variant stock grid, shown under a product row when it is
 * expanded on the products list.
 *
 * One row per variant, each with:
 *   - the size and price (context for what you are counting)
 *   - a number input for the shelf count (`stock`)
 *   - the reserved count (bags an unpaid manual order is holding), read-only
 *   - the resulting free / available count, derived
 *
 * The input saves on blur AND on Enter, so an operator counting bags on the
 * shelf can tab down the column without pressing extra buttons. A small
 * status glyph next to each row shows whether the value is unchanged, saving,
 * saved, or failed -- so what happened is visible on the row that changed
 * rather than as a page-wide banner. On save, router.refresh() re-reads the
 * whole product list so the header totals ("N in stock") update too.
 */
export function StockEditor({ variants }: { variants: ProductVariant[] }) {
  if (!variants.length) {
    return (
      <p className="px-4 pb-4 pt-1 text-xs text-sea-800">
        No sizes on this product yet. Add one under the product&apos;s own page.
      </p>
    );
  }

  return (
    <div className="border-t border-sea-200 bg-sea-50/60 px-4 py-3">
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-x-3 gap-y-2 text-xs">
        <div className="text-sea-800">Size</div>
        <div className="text-right text-sea-800">Stock</div>
        <div className="text-right text-sea-800">Held</div>
        <div className="text-right text-sea-800">Free</div>
        <div />
        {variants.map((variant) => (
          <StockRow key={variant.id} variant={variant} />
        ))}
      </div>
    </div>
  );
}

type Status = "idle" | "dirty" | "saving" | "saved" | "error";

function StockRow({ variant }: { variant: ProductVariant }) {
  const router = useRouter();
  const [value, setValue] = useState<string>(String(variant.stock));
  const [reserved, setReserved] = useState<number>(variant.reserved);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Free is stock - reserved, clamped so a saved-and-not-yet-refreshed row
  // never reads as negative.
  const parsedStock = Number(value);
  const free = Number.isFinite(parsedStock)
    ? Math.max(0, Math.round(parsedStock) - reserved)
    : 0;

  function commit() {
    if (status === "saving") return;
    const next = Number(value);
    if (!Number.isFinite(next) || next < 0) {
      setStatus("error");
      setErrorMsg("Stock cannot be negative.");
      return;
    }
    const rounded = Math.round(next);
    if (rounded === variant.stock && status !== "error") {
      // No change and no error to clear -- silent no-op.
      setStatus("idle");
      return;
    }
    setStatus("saving");
    setErrorMsg(null);
    startTransition(async () => {
      const result = await updateVariantStock(variant.id, rounded);
      if (!result.ok) {
        setStatus("error");
        setErrorMsg(result.reason);
        return;
      }
      // Locally reflect the saved value so the "held / free" number stays
      // right until the refresh lands.
      variant.stock = rounded;
      setValue(String(rounded));
      setReserved(variant.reserved);
      setStatus("saved");
      router.refresh();
    });
  }

  return (
    <>
      <div className="min-w-0">
        <p className="truncate font-medium text-ink">{variant.size}</p>
        <p className="text-[11px] text-sea-800">
          {formatIDR(variant.price_idr)}
          {!variant.is_active && " · hidden"}
        </p>
      </div>

      <input
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setStatus(event.target.value === String(variant.stock) ? "idle" : "dirty");
          setErrorMsg(null);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            (event.target as HTMLInputElement).blur();
          }
        }}
        disabled={pending}
        aria-label={`Stock for ${variant.size}`}
        className={cn(
          "input w-20 text-right text-sm",
          status === "error" && "border-red-400 focus:border-red-500",
        )}
      />

      <div
        className={cn(
          "text-right text-sm tabular-nums",
          reserved > 0 ? "text-amber-700" : "text-sea-800",
        )}
        title={reserved > 0 ? "Held by orders that are agreed but not yet paid." : undefined}
      >
        {reserved}
      </div>

      <div
        className={cn(
          "text-right text-sm font-medium tabular-nums",
          free === 0 ? "text-red-700" : free <= 5 ? "text-amber-700" : "text-ink",
        )}
      >
        {free}
      </div>

      <StatusGlyph status={status} errorMsg={errorMsg} />
    </>
  );
}

function StatusGlyph({ status, errorMsg }: { status: Status; errorMsg: string | null }) {
  if (status === "saving") {
    return (
      <span className="flex items-center justify-center text-sea-800" title="Saving…">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="flex items-center justify-center text-emerald-700" title="Saved">
        <Check className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (status === "error") {
    return (
      <span
        className="flex items-center justify-center text-red-700"
        title={errorMsg ?? "Failed to save"}
      >
        <TriangleAlert className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (status === "dirty") {
    return (
      <span
        className="h-2 w-2 rounded-full bg-sea-400"
        title="Unsaved — click away or press Enter to save"
      />
    );
  }
  return <span className="w-3.5" aria-hidden />;
}
