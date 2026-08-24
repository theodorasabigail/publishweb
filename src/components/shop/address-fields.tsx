"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import type { BiteshipArea } from "@/lib/shipping/biteship";

/**
 * An Indonesian address, entered the way Indonesian addresses work.
 *
 * The generic western form — street, city, state, postcode — has no room for
 * kecamatan or kelurahan, which is why people end up typing the whole address
 * into the street box. Those two levels get their own fields here, and the
 * whole administrative half of the address is chosen from Biteship's own area
 * list rather than typed: the same list the courier rates against, so what the
 * customer picks and what the courier understands cannot drift apart.
 *
 * Typing still works. If the lookup is unavailable — no Biteship key, the shop
 * on flat zones, their API having a bad afternoon — the fields stay editable
 * and the form behaves exactly as it did before any of this existed. Nobody is
 * ever unable to give their address because a courier's API is down.
 */

export interface AddressValue {
  recipient_name: string;
  phone: string;
  email?: string | null;
  line1: string;
  line2?: string | null;
  village?: string | null;
  district?: string | null;
  city: string;
  province?: string | null;
  postal_code?: string | null;
  country: string;
  area_id?: string | null;
}

export const EMPTY_ADDRESS: AddressValue = {
  recipient_name: "",
  phone: "",
  email: "",
  line1: "",
  line2: "",
  village: "",
  district: "",
  city: "",
  province: "",
  postal_code: "",
  country: "ID",
  area_id: null,
};

/** The administrative half of an address, as one readable line. */
export function areaSummary(value: AddressValue): string {
  return [value.village, value.district, value.city, value.province, value.postal_code]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
}

/**
 * The area picker on its own.
 *
 * Separate from AddressFields because the checkout form also serves addresses
 * outside Indonesia and cannot simply be replaced by an Indonesian form — it
 * needs this one piece, shown only when the country is ID, dropped into the
 * layout it already has.
 */
export function AreaLookup({
  onPick,
  chosen,
  idPrefix = "area",
}: {
  onPick: (area: BiteshipArea) => void;
  /** The area already selected, as one line. Shown instead of the box. */
  chosen?: string;
  idPrefix?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BiteshipArea[]>([]);
  const [searching, setSearching] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [editing, setEditing] = useState(false);
  const latest = useRef(0);

  // Debounced: an area lookup per keystroke is a request per keystroke.
  useEffect(() => {
    const term = query.trim();
    // Nothing cleared here — what is *shown* is derived below, so a short
    // query hides stale results without a second render to do it.
    if (term.length < 3) return;

    const ticket = ++latest.current;
    // Set inside the timer rather than in the effect body: the spinner then
    // marks the request actually being made, not a keystroke that may yet be
    // superseded before anything is sent.
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(
          `/api/shipping/areas?q=${encodeURIComponent(term)}`,
        );
        const payload = (await response.json()) as {
          areas?: BiteshipArea[];
          unavailable?: boolean;
        };
        // A slower earlier request must not overwrite a newer answer.
        if (ticket !== latest.current) return;
        setResults(payload.areas ?? []);
        setUnavailable(Boolean(payload.unavailable));
      } catch {
        if (ticket === latest.current) setUnavailable(true);
      } finally {
        if (ticket === latest.current) setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Derived rather than cleared: results only count while the query that
  // asked for them is still long enough to have meant something.
  const visible = query.trim().length >= 3 ? results : [];

  if (chosen && !editing) {
    return (
      <div className="flex items-start justify-between gap-2 rounded-lg border border-sea-200 bg-sea-50 px-3 py-2">
        <span className="flex items-start gap-2 text-sm">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sea-800" />
          {chosen}
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="shrink-0 text-xs text-sea-800 underline"
        >
          Ganti
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        id={`${idPrefix}-input`}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="input"
        placeholder="Ketik kelurahan atau kecamatan…"
        autoComplete="off"
        aria-label="Cari kelurahan atau kecamatan"
      />
      {searching && (
        <span className="absolute right-3 top-3 text-xs text-sea-800">mencari…</span>
      )}

      {visible.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-sea-200 bg-white shadow-lg">
          {visible.map((area) => (
            <li key={area.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(area);
                  setQuery("");
                  setResults([]);
                  setEditing(false);
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-sea-50"
              >
                {area.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-1.5 text-xs text-sea-800">
        {unavailable
          ? "Pencarian sedang tidak tersedia — isi manual di bawah."
          : "Pilih dari daftar supaya kode pos dan ongkirnya tepat."}
      </p>
    </div>
  );
}

export function AddressFields({
  value,
  onChange,
  showEmail = true,
  idPrefix = "address",
}: {
  value: AddressValue;
  onChange: (next: AddressValue) => void;
  showEmail?: boolean;
  idPrefix?: string;
}) {
  function set(field: keyof AddressValue, next: string) {
    onChange({
      ...value,
      [field]: next,
      // Any hand-edit to the administrative half means this is no longer the
      // area that was picked, and claiming otherwise would send the courier a
      // key that disagrees with the words next to it.
      ...(field === "village" ||
      field === "district" ||
      field === "city" ||
      field === "province" ||
      field === "postal_code"
        ? { area_id: null }
        : {}),
    });
  }

  function chooseArea(area: BiteshipArea) {
    onChange({
      ...value,
      village: area.village ?? "",
      district: area.district ?? "",
      city: area.city ?? "",
      province: area.province ?? "",
      postal_code: area.postalCode ?? "",
      country: "ID",
      area_id: area.id,
    });
  }

  const chosen = areaSummary(value);

  return (
    <div className="space-y-3">
      <div>
        <label className="label" htmlFor={`${idPrefix}-name`}>
          Nama penerima
        </label>
        <input
          id={`${idPrefix}-name`}
          value={value.recipient_name}
          onChange={(event) => set("recipient_name", event.target.value)}
          className="input"
          autoComplete="name"
        />
      </div>

      <div className={showEmail ? "grid gap-3 sm:grid-cols-2" : "grid gap-3"}>
        <div>
          <label className="label" htmlFor={`${idPrefix}-phone`}>
            Nomor WhatsApp
          </label>
          <input
            id={`${idPrefix}-phone`}
            value={value.phone}
            onChange={(event) => set("phone", event.target.value)}
            className="input"
            placeholder="0812…"
            autoComplete="tel"
            inputMode="tel"
          />
        </div>
        {showEmail && (
          <div>
            <label className="label" htmlFor={`${idPrefix}-email`}>
              Email
            </label>
            <input
              id={`${idPrefix}-email`}
              type="email"
              value={value.email ?? ""}
              onChange={(event) => set("email", event.target.value)}
              className="input"
              autoComplete="email"
            />
          </div>
        )}
      </div>

      {/* The administrative half, chosen rather than typed. */}
      <div>
        <label className="label" htmlFor={`${idPrefix}-area`}>
          Kelurahan / kecamatan / kota
        </label>

        <AreaLookup onPick={chooseArea} chosen={chosen} idPrefix={idPrefix} />
      </div>

      {/* Always editable, so a place the lookup does not know is still
          deliverable — and so a wrong pick can be corrected rather than
          restarted. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`${idPrefix}-village`}>
            Kelurahan / desa
          </label>
          <input
            id={`${idPrefix}-village`}
            value={value.village ?? ""}
            onChange={(event) => set("village", event.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor={`${idPrefix}-district`}>
            Kecamatan
          </label>
          <input
            id={`${idPrefix}-district`}
            value={value.district ?? ""}
            onChange={(event) => set("district", event.target.value)}
            className="input"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`${idPrefix}-city`}>
            Kota / kabupaten
          </label>
          <input
            id={`${idPrefix}-city`}
            value={value.city}
            onChange={(event) => set("city", event.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor={`${idPrefix}-province`}>
            Provinsi
          </label>
          <input
            id={`${idPrefix}-province`}
            value={value.province ?? ""}
            onChange={(event) => set("province", event.target.value)}
            className="input"
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor={`${idPrefix}-line1`}>
          Alamat jalan
        </label>
        <input
          id={`${idPrefix}-line1`}
          value={value.line1}
          onChange={(event) => set("line1", event.target.value)}
          className="input"
          placeholder="Nama jalan dan nomor rumah"
          autoComplete="address-line1"
        />
      </div>

      <div>
        <label className="label" htmlFor={`${idPrefix}-line2`}>
          RT / RW, patokan
        </label>
        <input
          id={`${idPrefix}-line2`}
          value={value.line2 ?? ""}
          onChange={(event) => set("line2", event.target.value)}
          className="input"
          placeholder="RT.01/RW.02, dekat masjid…"
          autoComplete="address-line2"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`${idPrefix}-postal`}>
            Kode pos
          </label>
          <input
            id={`${idPrefix}-postal`}
            value={value.postal_code ?? ""}
            onChange={(event) => set("postal_code", event.target.value)}
            className="input"
            inputMode="numeric"
            autoComplete="postal-code"
          />
        </div>
        <div>
          <label className="label" htmlFor={`${idPrefix}-country`}>
            Negara
          </label>
          <input
            id={`${idPrefix}-country`}
            value={value.country}
            onChange={(event) => set("country", event.target.value)}
            className="input"
          />
        </div>
      </div>
    </div>
  );
}
