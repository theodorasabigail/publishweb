"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Check, X } from "lucide-react";
import {
  bulkAdjustPrices,
  bulkAdjustStock,
  bulkDeleteProducts,
  bulkSetProductFlags,
} from "@/app/admin/_actions/products";
import { FLAVOUR_LEVELS, FLAVOUR_SWATCH_RING } from "@/lib/flavour";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

type Panel = "price" | "stock" | "flavour" | "category" | null;

/**
 * What you can do to a set of coffees at once.
 *
 * Sticky to the bottom of the window rather than a menu at the top, because
 * selecting rows means scrolling and a control that scrolls away is a control
 * you cannot reach when you have finished choosing.
 *
 * Deleting is the one action that asks twice. Everything else here is
 * reversible by doing the opposite; that one is not.
 */
export function BulkBar({
  selected,
  categories,
  onDone,
  onClear,
}: {
  selected: string[];
  categories: Category[];
  onDone: (message: string) => void;
  onClear: () => void;
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [priceMode, setPriceMode] = useState<"percent" | "amount">("percent");
  const [priceValue, setPriceValue] = useState("");
  const [roundTo, setRoundTo] = useState("500");
  const [stockMode, setStockMode] = useState<"add" | "set">("add");
  const [stockValue, setStockValue] = useState("");

  const count = selected.length;
  const noun = `${count} ${count === 1 ? "coffee" : "coffees"}`;

  function run(action: () => Promise<string>) {
    setError(null);
    startTransition(async () => {
      try {
        const message = await action();
        setPanel(null);
        setConfirmingDelete(false);
        setPriceValue("");
        setStockValue("");
        onDone(message);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "That did not work.");
      }
    });
  }

  return (
    <div className="sticky bottom-0 z-20 -mx-5 mt-4 border-t border-sea-300 bg-white/95 px-5 py-3 backdrop-blur sm:-mx-8 sm:px-8">
      {error && (
        <p className="mb-3 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      {/* --- Expanded panels -------------------------------------------- */}

      {panel === "price" && (
        <Panel title={`Change prices on ${noun}`} onClose={() => setPanel(null)}>
          <div className="flex flex-wrap items-end gap-3">
            <select
              className="input w-auto"
              value={priceMode}
              onChange={(e) => setPriceMode(e.target.value as "percent" | "amount")}
            >
              <option value="percent">By a percentage</option>
              <option value="amount">By a fixed amount</option>
            </select>
            <input
              type="number"
              className="input w-32"
              placeholder={priceMode === "percent" ? "10" : "5000"}
              value={priceValue}
              onChange={(e) => setPriceValue(e.target.value)}
            />
            <span className="pb-2 text-sm text-sea-800">
              {priceMode === "percent" ? "%" : "Rp"}
            </span>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-sea-800">round to</span>
              <select
                className="input w-auto"
                value={roundTo}
                onChange={(e) => setRoundTo(e.target.value)}
              >
                <option value="1">no rounding</option>
                <option value="500">nearest 500</option>
                <option value="1000">nearest 1.000</option>
                <option value="5000">nearest 5.000</option>
              </select>
            </label>
            <button
              type="button"
              disabled={pending || !priceValue}
              className="btn-primary py-2 text-xs"
              onClick={() =>
                run(async () => {
                  const result = await bulkAdjustPrices(selected, {
                    mode: priceMode,
                    value: Number(priceValue),
                    roundTo: Number(roundTo),
                  });
                  return `${result.updated} price${result.updated === 1 ? "" : "s"} changed.`;
                })
              }
            >
              {pending ? "Working…" : "Apply"}
            </button>
          </div>
          <p className="mt-2 text-xs text-sea-800">
            Applies to every size of every selected coffee. A negative number
            brings prices down.
          </p>
        </Panel>
      )}

      {panel === "stock" && (
        <Panel title={`Change stock on ${noun}`} onClose={() => setPanel(null)}>
          <div className="flex flex-wrap items-end gap-3">
            <select
              className="input w-auto"
              value={stockMode}
              onChange={(e) => setStockMode(e.target.value as "add" | "set")}
            >
              <option value="add">Add to what is there</option>
              <option value="set">Set every size to</option>
            </select>
            <input
              type="number"
              className="input w-28"
              placeholder="12"
              value={stockValue}
              onChange={(e) => setStockValue(e.target.value)}
            />
            <span className="pb-2 text-sm text-sea-800">bags</span>
            <button
              type="button"
              disabled={pending || !stockValue}
              className="btn-primary py-2 text-xs"
              onClick={() =>
                run(async () => {
                  const result = await bulkAdjustStock(selected, {
                    mode: stockMode,
                    value: Number(stockValue),
                  });
                  return `Stock updated on ${result.updated} size${result.updated === 1 ? "" : "s"}.`;
                })
              }
            >
              {pending ? "Working…" : "Apply"}
            </button>
          </div>
        </Panel>
      )}

      {panel === "flavour" && (
        <Panel title={`Flavour colour for ${noun}`} onClose={() => setPanel(null)}>
          <div className="flex flex-wrap items-center gap-2">
            {FLAVOUR_LEVELS.map((entry) => (
              <button
                key={entry.level}
                type="button"
                disabled={pending}
                title={`${entry.label} — ${entry.description}`}
                className="h-10 w-10 rounded-lg transition-transform hover:scale-105"
                style={{ backgroundColor: entry.hex, border: FLAVOUR_SWATCH_RING }}
                onClick={() =>
                  run(async () => {
                    await bulkSetProductFlags(selected, { flavour_level: entry.level });
                    return `${noun} set to ${entry.label}.`;
                  })
                }
              >
                <span className="text-sm text-ink/70">{entry.level}</span>
              </button>
            ))}
            <button
              type="button"
              disabled={pending}
              className="btn-secondary py-2 text-xs"
              onClick={() =>
                run(async () => {
                  await bulkSetProductFlags(selected, { flavour_level: null });
                  return `Flavour colour cleared on ${noun}.`;
                })
              }
            >
              Clear
            </button>
          </div>
        </Panel>
      )}

      {panel === "category" && (
        <Panel title={`Category for ${noun}`} onClose={() => setPanel(null)}>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                disabled={pending}
                className="btn-secondary py-2 text-xs"
                onClick={() =>
                  run(async () => {
                    await bulkSetProductFlags(selected, { category_id: category.id });
                    return `${noun} moved to ${category.name}.`;
                  })
                }
              >
                {category.name}
              </button>
            ))}
            <button
              type="button"
              disabled={pending}
              className="btn-secondary py-2 text-xs"
              onClick={() =>
                run(async () => {
                  await bulkSetProductFlags(selected, { category_id: null });
                  return `${noun} removed from their category.`;
                })
              }
            >
              None
            </button>
          </div>
        </Panel>
      )}

      {confirmingDelete && (
        <Panel
          title={`Delete ${noun}?`}
          onClose={() => setConfirmingDelete(false)}
          tone="danger"
        >
          <p className="text-sm text-sea-900">
            This cannot be undone. Past orders are safe — they keep their own
            record of what was bought and for how much — but the coffees
            themselves, and their prices and stock, are gone.
          </p>
          <p className="mt-2 text-sm text-sea-900">
            If you only want them off the shop, <strong>Hide</strong> does that
            and can be undone.
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={pending}
              className="btn-danger py-2 text-xs"
              onClick={() =>
                run(async () => {
                  const result = await bulkDeleteProducts(selected);
                  onClear();
                  return `${result.deleted} deleted.`;
                })
              }
            >
              {pending ? "Deleting…" : `Yes, delete ${noun}`}
            </button>
            <button
              type="button"
              className="btn-secondary py-2 text-xs"
              onClick={() => setConfirmingDelete(false)}
            >
              Cancel
            </button>
          </div>
        </Panel>
      )}

      {/* --- The bar itself ---------------------------------------------- */}

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm font-medium">{noun} selected</span>

        <Action label="Prices" onClick={() => setPanel(panel === "price" ? null : "price")} active={panel === "price"} />
        <Action label="Stock" onClick={() => setPanel(panel === "stock" ? null : "stock")} active={panel === "stock"} />
        <Action label="Flavour" onClick={() => setPanel(panel === "flavour" ? null : "flavour")} active={panel === "flavour"} />
        {categories.length > 0 && (
          <Action label="Category" onClick={() => setPanel(panel === "category" ? null : "category")} active={panel === "category"} />
        )}

        <span className="mx-1 h-5 w-px bg-sea-300" />

        <Action
          label="Show"
          disabled={pending}
          onClick={() =>
            run(async () => {
              await bulkSetProductFlags(selected, { is_active: true });
              return `${noun} now visible in the shop.`;
            })
          }
        />
        <Action
          label="Hide"
          disabled={pending}
          onClick={() =>
            run(async () => {
              await bulkSetProductFlags(selected, { is_active: false });
              return `${noun} hidden from the shop.`;
            })
          }
        />
        <Action
          label="Unfeature"
          disabled={pending}
          onClick={() =>
            run(async () => {
              await bulkSetProductFlags(selected, { is_featured: false });
              return `${noun} no longer featured.`;
            })
          }
        />

        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirmingDelete(true)}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
        >
          Delete…
        </button>

        <button
          type="button"
          onClick={onClear}
          className="ml-auto flex items-center gap-1.5 text-xs text-sea-800 hover:text-ink"
        >
          <X className="h-3.5 w-3.5" /> Clear selection
        </button>
      </div>
    </div>
  );
}

function Action({
  label,
  onClick,
  active,
  disabled,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
        active
          ? "border-sea-900 bg-sea-900 text-cream"
          : "border-sea-300 hover:bg-sea-100",
      )}
    >
      {label}
    </button>
  );
}

function Panel({
  title,
  children,
  onClose,
  tone,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  tone?: "danger";
}) {
  return (
    <div
      className={cn(
        "mb-3 rounded-lg border p-4",
        tone === "danger" ? "border-red-300 bg-red-50" : "border-sea-300 bg-sea-50",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{title}</p>
        <button type="button" onClick={onClose} aria-label="Close">
          <X className="h-4 w-4 text-sea-800" />
        </button>
      </div>
      {children}
    </div>
  );
}

export function SavedFlash({ message }: { message: string }) {
  return (
    <p className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
      <Check className="h-4 w-4 shrink-0" />
      {message}
    </p>
  );
}
