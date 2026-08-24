"use client";

import { useState, useTransition } from "react";
import { Search, UserPlus, X } from "lucide-react";
import { findCustomers } from "@/app/admin/_actions/pos";

/**
 * Search for a customer by name or email and hand back the picked id.
 *
 * A tiny wrapper around the till's findCustomers -- one search behaviour, one
 * ranked list, so an operator who has been using the till already knows how
 * this feels. Renders as an inline form, so it can sit inside any parent
 * form-action without hijacking the parent's submit.
 */
export function CustomerPicker({
  action,
  orderId,
  current,
}: {
  action: (formData: FormData) => Promise<void>;
  orderId: string;
  current: { id: string; display_name: string | null; email: string | null } | null;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    { id: string; display_name: string | null; email: string | null; loyalty_points: number }[]
  >([]);
  const [pending, startTransition] = useTransition();

  function search(value: string) {
    setQuery(value);
    startTransition(async () => {
      setResults(await findCustomers(value));
    });
  }

  if (current) {
    return (
      <form action={action}>
        <input type="hidden" name="id" value={orderId} />
        <input type="hidden" name="user_id" value="" />
        <div className="flex items-center justify-between gap-2 rounded-lg border border-sea-200 bg-sea-50 px-3 py-2">
          <span className="min-w-0 text-sm">
            <strong className="block truncate text-ink">
              {current.display_name || current.email}
            </strong>
            {current.email && current.display_name && (
              <span className="block truncate text-xs text-sea-800">{current.email}</span>
            )}
          </span>
          <button
            type="submit"
            aria-label="Detach customer"
            className="shrink-0 rounded p-1 text-sea-800 hover:bg-sea-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-xs text-sea-800">
          Detaching an already-paid order takes back the loyalty points it awarded.
        </p>
      </form>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sea-800" />
        <input
          value={query}
          onChange={(event) => search(event.target.value)}
          placeholder="Search name or email…"
          className="input pl-9 text-sm"
          aria-label="Find a customer"
        />
      </div>
      {pending && <p className="text-xs text-sea-800">Searching…</p>}
      {results.length > 0 && (
        <ul className="rounded-lg border border-sea-200">
          {results.map((found) => (
            <li key={found.id}>
              <form action={action}>
                <input type="hidden" name="id" value={orderId} />
                <input type="hidden" name="user_id" value={found.id} />
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-sea-50"
                >
                  <UserPlus className="h-3.5 w-3.5 text-sea-800" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {found.display_name || found.email}
                    </span>
                    <span className="block truncate text-xs text-sea-800">
                      {found.loyalty_points} points
                    </span>
                  </span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
      {query.length >= 2 && !pending && results.length === 0 && (
        <p className="text-xs text-sea-800">Nobody found. Check the spelling.</p>
      )}
    </div>
  );
}
