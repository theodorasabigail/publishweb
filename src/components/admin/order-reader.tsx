"use client";

import { useState, useTransition } from "react";
import { Check, ClipboardPaste, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { readOrders, saveReadOrder } from "@/app/admin/_actions/read-orders";
import type { CatalogueEntry, ReadOrder } from "@/lib/order-reading";
import { cn, formatIDR } from "@/lib/utils";

/**
 * "Paste the whole order."
 *
 * The customer has already written everything down: what they want, where it
 * goes, whether they have paid. This reads it -- with Claude when the shop has
 * an API key, with plain matching otherwise -- and hands the result to the
 * till to check. One order fills the till. Several become a list to tick
 * through, each savable on its own or all at once.
 */
export function OrderReader({
  onFill,
}: {
  onFill: (order: ReadOrder, source: "ai" | "basic", notice?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [batch, setBatch] = useState<{
    orders: ReadOrder[];
    catalogue: CatalogueEntry[];
    source: "ai" | "basic";
    notice?: string;
  } | null>(null);
  const [reading, startReading] = useTransition();

  function read() {
    setError(null);
    startReading(async () => {
      const result = await readOrders(text).catch(() => null);
      if (!result) {
        setError("Could not reach the server. Try again.");
        return;
      }
      if (!result.ok) {
        setError(result.error ?? "Could not read that.");
        return;
      }
      if (result.orders.length === 1) {
        onFill(result.orders[0], result.source, result.notice);
        setText("");
        setOpen(false);
        return;
      }
      setBatch({
        orders: result.orders,
        catalogue: result.catalogue,
        source: result.source,
        notice: result.notice,
      });
      setText("");
    });
  }

  if (batch) {
    return (
      <BatchList
        {...batch}
        onOpen={(order) => onFill(order, batch.source, batch.notice)}
        onDone={() => {
          setBatch(null);
          setOpen(false);
        }}
      />
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-4 flex w-full items-center gap-3 rounded-xl border border-dashed border-sea-400 bg-white px-4 py-3 text-left hover:border-sea-700 hover:bg-sea-50"
      >
        <ClipboardPaste className="h-5 w-5 shrink-0 text-sea-800" />
        <span>
          <span className="block text-sm font-medium">Paste an order</span>
          <span className="block text-xs text-sea-800">
            Copy their message from WhatsApp or Instagram — coffee, address and
            payment are filled in for you. Paste several to do them in one go.
          </span>
        </span>
      </button>
    );
  }

  return (
    <div className="mb-4 rounded-xl border border-sea-200 bg-white p-4">
      <label htmlFor="order-paste" className="mb-1.5 block text-sm font-medium">
        Paste the customer&apos;s message
      </label>
      <textarea
        id="order-paste"
        autoFocus
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={6}
        placeholder={
          "halo kak, mau pesan Gayo 200gr 2 sama Kintamani 1kg 1 ya\nkirim ke Rina, 0813 1234 5678\nJl. Kenanga 5 RT 3/7, Cempaka Putih, Jakarta Pusat 10510\nudah transfer ya kak"
        }
        className="input text-sm"
      />
      <p className="mt-1.5 text-xs text-sea-800">
        Several orders? Paste them all, with a blank line between each.
      </p>
      {error && (
        <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-800" role="alert">
          {error}
        </p>
      )}
      <div className="mt-3 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="text-sm text-sea-800 hover:underline"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={read}
          disabled={reading || !text.trim()}
          className="btn-primary py-2 text-sm"
        >
          {reading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Reading…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> Read order
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function BatchList({
  orders: initial,
  catalogue,
  source,
  notice,
  onOpen,
  onDone,
}: {
  orders: ReadOrder[];
  catalogue: CatalogueEntry[];
  source: "ai" | "basic";
  notice?: string;
  onOpen: (order: ReadOrder) => void;
  onDone: () => void;
}) {
  const byId = new Map(catalogue.map((entry) => [entry.variantId, entry]));
  const [rows, setRows] = useState(
    initial.map((order, index) => ({
      key: index,
      order,
      state: "waiting" as "waiting" | "saving" | "saved" | "error" | "opened",
      message: "",
    })),
  );
  const [, startSaving] = useTransition();

  const ready = (order: ReadOrder) => order.items.length > 0 && order.unmatched.length === 0;
  const pending = rows.filter((row) => row.state === "waiting" || row.state === "error");
  const readyCount = pending.filter((row) => ready(row.order)).length;

  function update(key: number, patch: Partial<(typeof rows)[number]>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function save(key: number, order: ReadOrder) {
    update(key, { state: "saving", message: "" });
    startSaving(async () => {
      const result = await saveReadOrder(order).catch(() => ({
        ok: false,
        ref: undefined,
        error: "Could not reach the server.",
      }));
      update(key, result.ok
        ? { state: "saved", message: result.ref ?? "" }
        : { state: "error", message: result.error ?? "Could not save." });
    });
  }

  return (
    <div className="mb-4 rounded-xl border border-sea-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sea-200 px-4 py-3">
        <div>
          <p className="text-sm font-medium">{initial.length} orders found</p>
          <p className="text-xs text-sea-800">
            {source === "ai" ? "Read by AI" : "Matched by coffee name and size"} — check
            each, then save it, or open it in the till to change something.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {readyCount > 0 && (
            <button
              type="button"
              onClick={() =>
                pending.filter((row) => ready(row.order)).forEach((row) => save(row.key, row.order))
              }
              className="btn-primary py-1.5 text-xs"
            >
              Save the {readyCount} that look complete
            </button>
          )}
          <button type="button" onClick={onDone} className="text-xs text-sea-800 hover:underline">
            {pending.length ? "Close" : "Done"}
          </button>
        </div>
      </div>

      {notice && <p className="border-b border-sea-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">{notice}</p>}

      <ul className="divide-y divide-sea-200">
        {rows.map(({ key, order, state, message }) => {
          const total = order.items.reduce(
            (sum, item) => sum + (byId.get(item.variantId)?.priceIdr ?? 0) * item.quantity,
            0,
          ) + (order.ships ? (order.shippingIdr ?? 0) : 0);
          const done = state === "saved" || state === "opened";
          return (
            <li key={key} className={cn("px-4 py-3", done && "opacity-60")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 text-sm">
                  <p className="font-medium">
                    {order.customerName || order.address.recipient_name || "No name"}
                    {order.phone && <span className="font-normal text-sea-800"> · {order.phone}</span>}
                  </p>
                  <ul className="mt-1 text-xs">
                    {order.items.map((item) => {
                      const entry = byId.get(item.variantId);
                      return (
                        <li key={item.variantId}>
                          {item.quantity} × {entry?.productName} {entry?.size}
                          {entry && item.quantity > entry.available && (
                            <span className="ml-1 text-amber-700">
                              ({item.quantity - Math.max(0, entry.available)} to roast)
                            </span>
                          )}
                        </li>
                      );
                    })}
                    {!order.items.length && !order.unmatched.length && (
                      <li className="text-amber-800">
                        <TriangleAlert className="mr-1 inline h-3 w-3" />
                        No coffee found in this message — open it in the till to add it.
                      </li>
                    )}
                    {order.unmatched.map((line) => (
                      <li key={line} className="text-amber-800">
                        <TriangleAlert className="mr-1 inline h-3 w-3" />
                        Not matched: “{line}”
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-xs text-sea-800">
                    {order.ships === true
                      ? `Shipping to ${[order.address.line1, order.address.city].filter(Boolean).join(", ") || "an address not given yet"}`
                      : order.ships === false
                        ? "Collecting"
                        : "Delivery not said"}
                    {" · "}
                    {order.paid ? "Paid" : order.paid === false ? "Not paid yet" : "Payment not said — saved as not paid"}
                    {total > 0 && ` · ${formatIDR(total)}`}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2 text-xs">
                  {state === "saved" ? (
                    <span className="flex items-center gap-1 text-emerald-700">
                      <Check className="h-3.5 w-3.5" /> Saved {message}
                    </span>
                  ) : state === "opened" ? (
                    <span className="text-sea-800">Opened in the till</span>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          update(key, { state: "opened" });
                          onOpen(order);
                        }}
                        className="rounded-lg border border-sea-200 px-2.5 py-1 hover:border-sea-400"
                      >
                        Open in till
                      </button>
                      <button
                        type="button"
                        onClick={() => save(key, order)}
                        disabled={state === "saving" || !order.items.length}
                        className="rounded-lg bg-sea-800 px-2.5 py-1 text-cream disabled:opacity-40"
                      >
                        {state === "saving" ? "Saving…" : "Save"}
                      </button>
                    </>
                  )}
                </div>
              </div>
              {state === "error" && <p className="mt-1 text-xs text-red-700">{message}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
