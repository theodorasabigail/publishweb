"use client";

import { useState, useTransition } from "react";
import { Truck } from "lucide-react";
import {
  bookBiteshipShipment,
  fetchBiteshipOptionsForOrder,
} from "@/app/admin/_actions/shipping";
import type { BookableOption } from "@/lib/shipping/biteship-booking";
import { formatIDR } from "@/lib/utils";

/**
 * One-button courier booking, in three visible states:
 *
 *   idle       -- "Book with a courier" button
 *   picking    -- a list of live options, cheapest first, radio-select then book
 *   done       -- "Booked as <id>" so a page that stays open reads correctly
 *
 * Rate lookup is a network call, so it is deferred until the operator asks
 * for it. Every order page loading rates would spend a Biteship credit per
 * page-view, which is not what "hop to the dashboard" cost either.
 *
 * All error paths render as inline text -- an authentication miss, an
 * out-of-credit balance, a route with no couriers all end up in the same
 * red paragraph. The operator does not need to distinguish them to fix the
 * one that says "top up".
 */
export function BiteshipBooker({ orderId }: { orderId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<BookableOption[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [bookedId, setBookedId] = useState<string | null>(null);

  function loadOptions() {
    setError(null);
    setOptions(null);
    setPicked(null);
    startTransition(async () => {
      const result = await fetchBiteshipOptionsForOrder(orderId);
      if (!result.ok) {
        setError(result.reason);
        return;
      }
      setOptions(result.options);
      setPicked(result.options.length ? optionKey(result.options[0]) : null);
    });
  }

  function book() {
    if (!options || !picked) return;
    const option = options.find((o) => optionKey(o) === picked);
    if (!option) return;

    setError(null);
    startTransition(async () => {
      const result = await bookBiteshipShipment(
        orderId,
        option.courierCompany,
        option.courierService,
      );
      if (!result.ok) {
        setError(result.reason);
        return;
      }
      setBookedId(result.courierOrderId);
      setOptions(null);
      setPicked(null);
    });
  }

  if (bookedId) {
    return (
      <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
        <p className="font-medium">Shipment booked with Biteship.</p>
        <p className="mt-1 text-xs">
          Courier order id: <strong>{bookedId}</strong>. The waybill lands here
          automatically when Biteship dispatches — no need to refresh.
        </p>
      </div>
    );
  }

  if (options) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-sea-800">
          Cheapest first. Prices are what Biteship will charge you — the
          customer&apos;s paid what they paid, and any difference stays with
          the roastery.
        </p>
        <ul className="divide-y divide-sea-200 rounded-lg border border-sea-200">
          {options.map((option) => {
            const key = optionKey(option);
            const label = [option.courierName, option.serviceName]
              .filter(Boolean)
              .join(" ");
            return (
              <li key={key}>
                <label className="flex cursor-pointer items-start gap-3 px-3 py-2 text-sm hover:bg-sea-50">
                  <input
                    type="radio"
                    name="biteship-option"
                    value={key}
                    checked={picked === key}
                    onChange={() => setPicked(key)}
                    className="mt-0.5"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{label || "Courier"}</span>
                    {option.durationText && (
                      <span className="block text-xs text-sea-800">
                        {option.durationText}
                      </span>
                    )}
                  </span>
                  <span className="whitespace-nowrap font-medium">
                    {formatIDR(option.priceIdr)}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        {error && (
          <p className="text-xs text-red-700" role="alert">
            {error}
          </p>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={book}
            disabled={pending || !picked}
            className="btn-primary flex-1 py-1.5 text-sm"
          >
            {pending ? "Booking…" : "Book this courier"}
          </button>
          <button
            type="button"
            onClick={() => {
              setOptions(null);
              setPicked(null);
              setError(null);
            }}
            disabled={pending}
            className="text-xs text-sea-800 underline"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-sea-800">
        Book this shipment with Biteship. Pulls live rates first, then
        creates the courier order and records the waybill here.
      </p>
      <button
        type="button"
        onClick={loadOptions}
        disabled={pending}
        className="btn-secondary flex w-full items-center justify-center gap-2 py-2 text-sm"
      >
        <Truck className="h-4 w-4" />
        {pending ? "Getting options…" : "Book with a courier"}
      </button>
      {error && (
        <p className="text-xs text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function optionKey(option: BookableOption): string {
  return `${option.courierCompany}::${option.courierService}`;
}
