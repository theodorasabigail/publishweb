"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

const ROAST_LEVELS = [
  "Light",
  "Light-Medium",
  "Medium",
  "Medium-Dark",
  "Dark",
  "Not sure — advise me",
];

export function RoastingRequestForm({
  defaultEmail,
  defaultName,
}: {
  defaultEmail: string;
  defaultName: string;
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
        <p className="mt-4 font-serif text-xl">Request sent</p>
        <p className="mt-2 text-sm text-bark-600">
          Your reference is{" "}
          <span className="font-medium text-bark-900">{reference}</span>. We
          normally reply within one working day.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="contact_name">
          Your name *
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
            WhatsApp / phone *
          </label>
          <input
            id="contact_phone"
            className="input"
            required
            value={form.contact_phone}
            onChange={(event) => update("contact_phone", event.target.value)}
            placeholder="+62…"
          />
        </div>
        <div>
          <label className="label" htmlFor="email">
            Email
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
          Green bean origin *
        </label>
        <input
          id="origin"
          className="input"
          required
          value={form.green_bean_origin}
          onChange={(event) => update("green_bean_origin", event.target.value)}
          placeholder="e.g. Gayo, natural process"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="quantity">
            Quantity (kg) *
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
            Roast level
          </label>
          <select
            id="roast"
            className="input"
            value={form.desired_roast_level}
            onChange={(event) => update("desired_roast_level", event.target.value)}
          >
            <option value="">Choose…</option>
            {ROAST_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="notes">
          Anything else
        </label>
        <textarea
          id="notes"
          className="input min-h-24"
          value={form.notes}
          onChange={(event) => update("notes", event.target.value)}
          placeholder="Target profile, packaging, deadline…"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}

      <button type="submit" disabled={state === "sending"} className="btn-primary w-full">
        {state === "sending" ? "Sending…" : "Send request"}
      </button>
    </form>
  );
}
