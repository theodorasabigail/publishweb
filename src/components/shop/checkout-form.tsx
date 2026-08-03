"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart-provider";
import { parcelWeight, quoteShipping, resolveZone } from "@/lib/shipping";
import type { Address, ShippingZone } from "@/lib/types";
import { formatIDR } from "@/lib/utils";

const COUNTRIES = [
  { code: "ID", name: "Indonesia" },
  { code: "SG", name: "Singapore" },
  { code: "MY", name: "Malaysia" },
  { code: "TH", name: "Thailand" },
  { code: "PH", name: "Philippines" },
  { code: "VN", name: "Vietnam" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "HK", name: "Hong Kong" },
  { code: "TW", name: "Taiwan" },
  { code: "GB", name: "United Kingdom" },
  { code: "DE", name: "Germany" },
  { code: "NL", name: "Netherlands" },
  { code: "FR", name: "France" },
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "OTHER", name: "Somewhere else" },
];

const ID_PROVINCES = [
  "DKI Jakarta", "Jawa Barat", "Jawa Tengah", "Jawa Timur", "Banten",
  "DI Yogyakarta", "Bali", "Aceh", "Sumatera Utara", "Sumatera Barat",
  "Riau", "Kepulauan Riau", "Jambi", "Sumatera Selatan", "Bengkulu",
  "Lampung", "Kalimantan Barat", "Kalimantan Tengah", "Kalimantan Selatan",
  "Kalimantan Timur", "Kalimantan Utara", "Sulawesi Utara", "Sulawesi Tengah",
  "Sulawesi Selatan", "Sulawesi Tenggara", "Gorontalo", "Sulawesi Barat",
  "Nusa Tenggara Barat", "Nusa Tenggara Timur", "Maluku", "Maluku Utara",
  "Papua", "Papua Barat",
];

export function CheckoutForm({
  zones,
  savedAddresses,
  defaultEmail,
  defaultName,
  isSignedIn,
  providerIsManual,
}: {
  zones: ShippingZone[];
  savedAddresses: Address[];
  defaultEmail: string;
  defaultName: string;
  isSignedIn: boolean;
  providerIsManual: boolean;
}) {
  const router = useRouter();
  const { lines, subtotal, clear, ready } = useCart();

  const preset: Address | undefined =
    savedAddresses.find((address) => address.is_default) ?? savedAddresses[0];

  const [email, setEmail] = useState(defaultEmail);
  const [form, setForm] = useState({
    recipient_name: preset?.recipient_name ?? defaultName,
    phone: preset?.phone ?? "",
    line1: preset?.line1 ?? "",
    line2: preset?.line2 ?? "",
    city: preset?.city ?? "",
    province: preset?.province ?? "",
    postal_code: preset?.postal_code ?? "",
    country: preset?.country ?? "ID",
  });
  const [note, setNote] = useState("");
  const [saveAddress, setSaveAddress] = useState<boolean>(isSignedIn && !preset);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weight = useMemo(
    () =>
      parcelWeight(
        lines.map((line) => ({ weightGrams: line.weightGrams, quantity: line.quantity })),
      ),
    [lines],
  );

  // Same pure functions the checkout API uses server-side, so the number shown
  // here is the number that gets charged.
  const quote = useMemo(() => {
    const zone = resolveZone(zones, form.country, form.province);
    return zone ? quoteShipping(zone, weight, subtotal) : null;
  }, [zones, form.country, form.province, weight, subtotal]);

  const shipping = quote?.amountIdr ?? 0;
  const total = subtotal + shipping;

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!lines.length) {
      setError("Your cart is empty.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          note,
          saveAddress,
          address: form,
          items: lines.map((line) => ({
            variantId: line.variantId,
            quantity: line.quantity,
          })),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not place the order.");
      }

      clear();
      // Hosted checkout when the provider has one, our own order page otherwise.
      if (payload.redirectUrl) {
        window.location.href = payload.redirectUrl;
      } else {
        router.push(`/order/${payload.orderId}`);
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Something went wrong.",
      );
      setSubmitting(false);
    }
  }

  if (ready && !lines.length) {
    return (
      <div className="card p-10 text-center">
        <p className="font-serif text-xl">Your cart is empty</p>
        <Link href="/shop" className="btn-secondary mt-4">
          Browse the roast list
        </Link>
      </div>
    );
  }

  const isInternational = form.country !== "ID";

  return (
    <form onSubmit={onSubmit} className="grid gap-10 lg:grid-cols-[1fr_380px]">
      <div className="space-y-8">
        <section>
          <h2 className="text-xl">Contact</h2>
          <div className="mt-4">
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              className="input"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@email.com"
            />
            <p className="mt-1.5 text-xs text-bark-500">
              We send the receipt and tracking here.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl">Shipping address</h2>

          {savedAddresses.length > 1 && (
            <div className="mt-4">
              <label className="label" htmlFor="saved">
                Use a saved address
              </label>
              <select
                id="saved"
                className="input"
                onChange={(event) => {
                  const address = savedAddresses.find(
                    (item) => item.id === event.target.value,
                  );
                  if (!address) return;
                  setForm({
                    recipient_name: address.recipient_name,
                    phone: address.phone,
                    line1: address.line1,
                    line2: address.line2 ?? "",
                    city: address.city,
                    province: address.province ?? "",
                    postal_code: address.postal_code ?? "",
                    country: address.country,
                  });
                }}
                defaultValue={preset?.id}
              >
                {savedAddresses.map((address) => (
                  <option key={address.id} value={address.id}>
                    {address.recipient_name} — {address.line1}, {address.city}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Recipient name" required>
              <input
                className="input"
                required
                value={form.recipient_name}
                onChange={(event) => update("recipient_name", event.target.value)}
              />
            </Field>
            <Field label="Phone" required>
              <input
                className="input"
                required
                value={form.phone}
                onChange={(event) => update("phone", event.target.value)}
                placeholder="+62…"
              />
            </Field>

            <div className="sm:col-span-2">
              <Field label="Address" required>
                <input
                  className="input"
                  required
                  value={form.line1}
                  onChange={(event) => update("line1", event.target.value)}
                  placeholder="Street, number"
                />
              </Field>
            </div>

            <div className="sm:col-span-2">
              <Field label="Apartment, unit, landmark (optional)">
                <input
                  className="input"
                  value={form.line2}
                  onChange={(event) => update("line2", event.target.value)}
                />
              </Field>
            </div>

            <Field label="Country" required>
              <select
                className="input"
                value={form.country}
                onChange={(event) => update("country", event.target.value)}
              >
                {COUNTRIES.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={isInternational ? "State / region" : "Provinsi"} required>
              {form.country === "ID" ? (
                <select
                  className="input"
                  required
                  value={form.province}
                  onChange={(event) => update("province", event.target.value)}
                >
                  <option value="">Pilih provinsi…</option>
                  {ID_PROVINCES.map((province) => (
                    <option key={province} value={province}>
                      {province}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="input"
                  value={form.province}
                  onChange={(event) => update("province", event.target.value)}
                />
              )}
            </Field>

            <Field label={isInternational ? "City" : "Kota / kabupaten"} required>
              <input
                className="input"
                required
                value={form.city}
                onChange={(event) => update("city", event.target.value)}
              />
            </Field>

            <Field label="Postal code" required>
              <input
                className="input"
                required
                value={form.postal_code}
                onChange={(event) => update("postal_code", event.target.value)}
              />
            </Field>
          </div>

          {isSignedIn && (
            <label className="mt-4 flex items-center gap-2 text-sm text-bark-700">
              <input
                type="checkbox"
                checked={saveAddress}
                onChange={(event) => setSaveAddress(event.target.checked)}
                className="rounded border-bark-300"
              />
              Save this address to my account
            </label>
          )}
        </section>

        <section>
          <h2 className="text-xl">Order note (optional)</h2>
          <textarea
            className="input mt-3 min-h-24"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Grind for V60, gift wrap, delivery instructions…"
          />
        </section>

        {!isSignedIn && (
          <p className="rounded-xl bg-bark-100 p-4 text-sm text-bark-700">
            Checking out as a guest is fine. You can create an account after
            paying to keep your order history and start earning points.
          </p>
        )}
      </div>

      <aside className="h-fit card p-6 lg:sticky lg:top-24">
        <h2 className="text-xl">Your order</h2>

        <ul className="mt-4 space-y-3 text-sm">
          {lines.map((line) => (
            <li key={line.variantId} className="flex justify-between gap-3">
              <span className="text-bark-700">
                {line.name}{" "}
                <span className="text-bark-500">
                  · {line.size} × {line.quantity}
                </span>
              </span>
              <span className="shrink-0 font-medium">
                {formatIDR(line.priceIdr * line.quantity)}
              </span>
            </li>
          ))}
        </ul>

        <dl className="mt-5 space-y-2 border-t border-bark-200/70 pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-bark-600">Subtotal</dt>
            <dd>{formatIDR(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-bark-600">
              Shipping{quote ? ` — ${quote.zoneName}` : ""}
            </dt>
            <dd>{quote?.isFree ? "Free" : formatIDR(shipping)}</dd>
          </div>
          {quote?.estimate && (
            <p className="text-xs text-bark-500">Estimated {quote.estimate}</p>
          )}
          <div className="flex justify-between border-t border-bark-200/70 pt-3 text-base font-medium">
            <dt>Total</dt>
            <dd>{formatIDR(total)}</dd>
          </div>
        </dl>

        {providerIsManual && (
          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
            A unique 3-digit code is added to your total on the next screen. Pay
            that exact amount so we can match your transfer automatically.
          </p>
        )}

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">
            {error}
          </p>
        )}

        <button type="submit" disabled={submitting} className="btn-primary mt-5 w-full">
          {submitting ? "Placing order…" : "Place order"}
        </button>

        <p className="mt-3 text-center text-xs text-bark-500">
          Prices are confirmed on our server before payment.
        </p>
      </aside>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label">
        {label}
        {required && <span className="text-bark-400"> *</span>}
      </label>
      {children}
    </div>
  );
}
