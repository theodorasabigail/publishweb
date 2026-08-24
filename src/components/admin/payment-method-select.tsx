"use client";

import { useState } from "react";

/**
 * A dropdown of the shop's configured payment methods, with an "Other…"
 * escape hatch that reveals a free-text box.
 *
 * The list itself is edited in Settings and shared across the admin. The
 * escape hatch is there so a one-off method — a wallet a customer used once —
 * does not need a trip to Settings to be recorded correctly.
 *
 * Submits as `name` under whichever branch the operator chose, so the server
 * always receives one value.
 */
export function PaymentMethodSelect({
  name,
  methods,
  defaultValue,
}: {
  name: string;
  methods: string[];
  defaultValue: string | null | undefined;
}) {
  const configured = new Set(methods);
  // A stored value not in the current list still shows correctly and stays
  // selected: the list can change after an order is written, and the truth
  // on the order is what was chosen at the time.
  const startsAsOther = Boolean(defaultValue) && !configured.has(defaultValue as string);

  const [value, setValue] = useState<string>(
    startsAsOther ? "__other__" : (defaultValue ?? ""),
  );
  const [other, setOther] = useState<string>(startsAsOther ? (defaultValue as string) : "");

  const isOther = value === "__other__";
  const submitted = isOther ? other : value;

  return (
    <div className="space-y-2">
      <select
        className="input"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-label="Payment method"
      >
        <option value="">Not set</option>
        {methods.map((method) => (
          <option key={method} value={method}>
            {method}
          </option>
        ))}
        <option value="__other__">Other…</option>
      </select>

      {isOther && (
        <input
          className="input"
          value={other}
          onChange={(event) => setOther(event.target.value)}
          placeholder="Type the payment method"
          aria-label="Custom payment method"
        />
      )}

      <input type="hidden" name={name} value={submitted} />
    </div>
  );
}
