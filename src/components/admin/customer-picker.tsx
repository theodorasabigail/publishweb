"use client";

import { useRef, useState, useTransition } from "react";
import { Plus, Search, UserPlus, X } from "lucide-react";
import { createCustomer, findCustomers } from "@/app/admin/_actions/pos";

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
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ display_name: "", email: "", phone: "" });
  const [createError, setCreateError] = useState<string | null>(null);
  const submitRef = useRef<HTMLFormElement | null>(null);

  function search(value: string) {
    setQuery(value);
    startTransition(async () => {
      setResults(await findCustomers(value));
    });
  }

  function createAndAttach() {
    setCreateError(null);
    startTransition(async () => {
      try {
        const made = await createCustomer({
          displayName: draft.display_name || null,
          email: draft.email || null,
          phone: draft.phone,
        });
        // Fill the assign form's hidden user_id and submit it.
        if (submitRef.current) {
          const input = submitRef.current.querySelector<HTMLInputElement>(
            'input[name="user_id"]',
          );
          if (input) input.value = made.id;
          submitRef.current.requestSubmit();
        }
      } catch (error) {
        setCreateError(
          error instanceof Error ? error.message : "Could not create the customer.",
        );
      }
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
      {query.length >= 2 && !pending && results.length === 0 && !creating && (
        <p className="text-xs text-sea-800">
          Nobody found.{" "}
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              // Prefill whichever kind of identifier the query looks like:
              // digits go to phone, an @-bearing string to email, everything
              // else stays as a name suggestion.
              setDraft((d) => {
                const looksLikePhone = /^[+0-9\s-]{4,}$/.test(query);
                const looksLikeEmail = query.includes("@");
                return {
                  display_name: !looksLikePhone && !looksLikeEmail ? query : d.display_name,
                  email: looksLikeEmail ? query : d.email,
                  phone: looksLikePhone ? query : d.phone,
                };
              });
            }}
            className="underline"
          >
            Create a new customer instead
          </button>
          .
        </p>
      )}

      {!creating && query.length < 2 && (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="mt-1 flex items-center gap-1.5 text-xs text-sea-800 hover:text-sea-900"
        >
          <Plus className="h-3 w-3" /> Or create a new customer
        </button>
      )}

      {creating && (
        <div className="space-y-2 rounded-lg border border-sea-200 bg-sea-50 p-3">
          <p className="text-xs text-sea-800">
            A phone number is required — that is how a WhatsApp customer is
            found and auto-suggested at the till. Email is optional, and can
            be added later once the customer signs up.
          </p>
          <input
            value={draft.display_name}
            onChange={(event) => setDraft({ ...draft, display_name: event.target.value })}
            placeholder="Name"
            className="input text-sm"
            aria-label="Customer name"
          />
          <input
            value={draft.phone}
            onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
            placeholder="Phone (0812… or +62 812…)"
            className="input text-sm"
            aria-label="Customer phone"
            inputMode="tel"
            autoComplete="off"
          />
          <input
            value={draft.email}
            onChange={(event) => setDraft({ ...draft, email: event.target.value })}
            placeholder="Email (optional)"
            type="email"
            className="input text-sm"
            aria-label="Customer email"
            autoComplete="off"
          />
          {createError && (
            <p className="text-xs text-red-700" role="alert">
              {createError}
            </p>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={createAndAttach}
              disabled={pending || !draft.phone.trim()}
              className="btn-primary flex-1 py-1.5 text-xs"
            >
              {pending ? "Creating…" : "Create and attach"}
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setCreateError(null);
              }}
              className="text-xs text-sea-800 underline"
            >
              Cancel
            </button>
          </div>

          {/* The action form the create flow submits into. Hidden — its own
              user_id gets filled in from the new profile before submit. */}
          <form ref={submitRef} action={action} className="hidden">
            <input type="hidden" name="id" value={orderId} />
            <input type="hidden" name="user_id" value="" />
          </form>
        </div>
      )}
    </div>
  );
}
