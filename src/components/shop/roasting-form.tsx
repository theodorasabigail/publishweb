"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

/**
 * Every visible word arrives as a prop.
 *
 * The page resolves them, because that is where the operator's overrides are
 * read; this component only renders what it is handed. Nothing here falls back
 * to English of its own, so there is exactly one place -- lib/page-text.ts --
 * where the shipped wording lives.
 */
export interface RoastingFormCopy {
  field_name: string;
  field_phone: string;
  field_phone_placeholder: string;
  field_email: string;
  field_origin: string;
  field_origin_placeholder: string;
  field_quantity: string;
  field_roast: string;
  field_roast_empty: string;
  roast_levels: string[];
  field_notes: string;
  field_notes_placeholder: string;
  submit: string;
  submitting: string;
  sent_title: string;
  sent_body: string;
}

export function RoastingRequestForm({
  defaultEmail,
  defaultName,
  copy,
}: {
  defaultEmail: string;
  defaultName: string;
  copy: RoastingFormCopy;
}) {
  const [form, setForm] = useState({
    contact_name: defaultName,
    contact_phone: "",
    email: defaultEmail,
    green_bean_origin: "",
    quantity_kg: "",
    desired_roast_level: "",
    notes: "",
  });
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [reference, setReference] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setState("sending");

    try {
      const response = await fetch("/api/roasting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          quantity_kg: Number(form.quantity_kg),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not send the request.");

      setReference(payload.reference);
      setState("sent");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Something went wrong.",
      );
      setState("idle");
    }
  }

  if (state === "sent") {
    return (
      <div className="text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
        <p className="mt-4 font-serif text-xl">{copy.sent_title}</p>
        <p className="mt-2 text-sm text-sea-800">
          Your reference is{" "}
          <span className="font-medium text-sea-900">{reference}</span>.{" "}
          {copy.sent_body}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="contact_name">
          {copy.field_name} *
        </label>
        <input
          id="contact_name"
          className="input"
          required
          value={form.contact_name}
          onChange={(event) => update("contact_name", event.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="contact_phone">
            {copy.field_phone} *
          </label>
          <input
            id="contact_phone"
            className="input"
            required
            value={form.contact_phone}
            onChange={(event) => update("contact_phone", event.target.value)}
            placeholder={copy.field_phone_placeholder}
          />
        </div>
        <div>
          <label className="label" htmlFor="email">
            {copy.field_email}
          </label>
          <input
            id="email"
            type="email"
            className="input"
            value={form.email}
            onChange={(event) => update("email", event.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="origin">
          {copy.field_origin} *
        </label>
        <input
          id="origin"
          className="input"
          required
          value={form.green_bean_origin}
          onChange={(event) => update("green_bean_origin", event.target.value)}
          placeholder={copy.field_origin_placeholder}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="quantity">
            {copy.field_quantity} *
          </label>
          <input
            id="quantity"
            type="number"
            min="1"
            step="0.5"
            className="input"
            required
            value={form.quantity_kg}
            onChange={(event) => update("quantity_kg", event.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="roast">
            {copy.field_roast}
          </label>
          <select
            id="roast"
            className="input"
            value={form.desired_roast_level}
            onChange={(event) => update("desired_roast_level", event.target.value)}
          >
            <option value="">{copy.field_roast_empty}</option>
            {copy.roast_levels.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="notes">
          {copy.field_notes}
        </label>
        <textarea
          id="notes"
          className="input min-h-24"
          value={form.notes}
          onChange={(event) => update("notes", event.target.value)}
          placeholder={copy.field_notes_placeholder}
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}

      <button type="submit" disabled={state === "sending"} className="btn-primary w-full">
        {state === "sending" ? copy.submitting : copy.submit}
      </button>
    </form>
  );
}
