"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { testCourierConnection } from "@/app/admin/_actions/settings";
import type { BiteshipDiagnosis } from "@/lib/shipping/biteship-provider";
import { formatIDR } from "@/lib/utils";

/**
 * "Is the courier connection actually working?"
 *
 * Without this the only way to find out is to place an order and guess,
 * because a courier failure deliberately falls back to flat rates rather than
 * showing a customer an error.
 */
export function CourierTest({ providerId }: { providerId: string }) {
  const [postcode, setPostcode] = useState("");
  const [result, setResult] = useState<BiteshipDiagnosis | null>(null);
  const [pending, startTransition] = useTransition();

  function run(formData: FormData) {
    startTransition(async () => setResult(await testCourierConnection(formData)));
  }

  return (
    <div>
      {providerId !== "biteship" && (
        <p className="mb-4 rounded-lg bg-bark-50 p-3 text-sm text-bark-700">
          The shop is currently using <strong>your own price list</strong>. To
          switch to live courier prices, add{" "}
          <code className="rounded bg-white px-1.5 py-0.5 text-xs">
            SHIPPING_PROVIDER=biteship
          </code>{" "}
          in Vercel and redeploy. You can still run the test below first.
        </p>
      )}

      <form action={run} className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="destination_postal_code">
            Send a test parcel to this postcode
          </label>
          <input
            id="destination_postal_code"
            name="destination_postal_code"
            className="input w-40"
            value={postcode}
            onChange={(event) => setPostcode(event.target.value)}
            placeholder="12240"
            inputMode="numeric"
          />
        </div>
        <button type="submit" disabled={pending || !postcode} className="btn-primary py-2 text-xs">
          {pending ? "Asking couriers…" : "Test the connection"}
        </button>
      </form>

      <p className="mt-2 text-xs text-bark-500">
        Pretends to send a 500 g parcel. Nothing is booked and nothing is
        charged.
      </p>

      {result && (
        <div
          className={`mt-5 rounded-lg border p-4 ${
            result.ok ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50"
          }`}
        >
          <p className="flex items-start gap-2 text-sm font-medium">
            {result.ok ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            )}
            {result.summary}
          </p>

          {result.advice && (
            <p className="mt-2 pl-6 text-sm text-bark-700">{result.advice}</p>
          )}

          {result.options.length > 0 && (
            <table className="mt-4 w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-bark-500">
                <tr>
                  <th className="pb-1 font-medium">Courier</th>
                  <th className="pb-1 font-medium">Price</th>
                  <th className="pb-1 font-medium">Time</th>
                  <th className="pb-1 font-medium">Collects from you?</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {result.options.map((option) => (
                  <tr key={option.label + option.priceIdr}>
                    <td className="py-1.5">{option.label}</td>
                    <td className="py-1.5">{formatIDR(option.priceIdr)}</td>
                    <td className="py-1.5 text-bark-600">{option.duration ?? "—"}</td>
                    <td className="py-1.5">
                      {option.collects ? (
                        "Yes"
                      ) : (
                        <span className="text-amber-800">
                          No — you would take it to a depot
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
