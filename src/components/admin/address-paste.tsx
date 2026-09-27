"use client";

import { useState } from "react";
import { ClipboardPaste, MapPin, Pencil } from "lucide-react";
import {
  AddressFields,
  areaSummary,
  type AddressValue,
} from "@/components/shop/address-fields";
import { areaQuery, parsePastedAddress, type ParsedAddress } from "@/lib/parse-address";
import { addressHasLocation, type ShippingAddressSnapshot } from "@/lib/types";
import type { BiteshipArea } from "@/lib/shipping/biteship";

/**
 * Where a manual order is going, taken from what the customer already sent.
 *
 * The whole address form is the storefront's, built for a customer typing
 * their own address once. The operator's version of the job is different:
 * the address is sitting in a chat, already written, and the work is getting
 * it across. So the default here is one box to paste into. The paste is split
 * into fields, the courier's area list is asked for the matching kelurahan,
 * and what comes out is shown as one card to check. The full form is still one
 * tap away for anything the guess got wrong.
 */
export function AddressPaste({
  value,
  onChange,
  onPhone,
  idPrefix = "paste-address",
}: {
  value: AddressValue;
  onChange: (next: AddressValue) => void;
  /** Told about a phone number found in a paste, so the till can look for the
   *  customer it belongs to. */
  onPhone?: (phone: string) => void;
  idPrefix?: string;
}) {
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [areas, setAreas] = useState<BiteshipArea[]>([]);
  const [looking, setLooking] = useState(false);

  const hasAddress = addressHasLocation(value as ShippingAddressSnapshot);
  const showPasteBox = pasting || (!hasAddress && !editing);

  function withArea(base: AddressValue, area: BiteshipArea): AddressValue {
    return {
      ...base,
      village: area.village ?? base.village ?? "",
      district: area.district ?? base.district ?? "",
      city: area.city ?? base.city,
      province: area.province ?? base.province ?? "",
      postal_code: area.postalCode ?? base.postal_code ?? "",
      country: "ID",
      area_id: area.id,
    };
  }

  async function findArea(parsed: ParsedAddress, base: AddressValue) {
    const query = areaQuery(parsed);
    if (query.trim().length < 3) return;

    setLooking(true);
    try {
      const response = await fetch(`/api/shipping/areas?q=${encodeURIComponent(query)}`);
      const payload = (await response.json()) as { areas?: BiteshipArea[] };
      const found = payload.areas ?? [];

      // One clear answer is taken without asking: the only result, or the only
      // one whose postcode is the one they wrote. Anything else is a choice.
      const byPostcode = parsed.postal_code
        ? found.filter((area) => area.postalCode === parsed.postal_code)
        : [];
      const sure = byPostcode.length === 1 ? byPostcode[0] : found.length === 1 ? found[0] : null;

      if (sure) {
        onChange(withArea(base, sure));
        setAreas([]);
      } else {
        setAreas((byPostcode.length ? byPostcode : found).slice(0, 4));
      }
    } catch {
      // No lookup, no harm: the typed-out fields are already filled in.
      setAreas([]);
    } finally {
      setLooking(false);
    }
  }

  function fill(source: string) {
    if (!source.trim()) return;
    const parsed = parsePastedAddress(source);
    const next: AddressValue = {
      recipient_name: parsed.recipient_name,
      phone: parsed.phone,
      email: parsed.email || value.email || "",
      line1: parsed.line1,
      line2: parsed.line2,
      village: parsed.village,
      district: parsed.district,
      city: parsed.city,
      province: parsed.province,
      postal_code: parsed.postal_code,
      country: "ID",
      area_id: null,
    };
    onChange(next);
    setText("");
    setPasting(false);
    setEditing(false);
    setAreas([]);
    if (parsed.phone) onPhone?.(parsed.phone);
    void findArea(parsed, next);
  }

  const missing = [
    !value.recipient_name?.trim() && "name",
    !value.phone?.trim() && "phone",
    !value.line1?.trim() && "street",
    !value.city?.trim() && "city",
  ].filter(Boolean) as string[];

  if (showPasteBox) {
    return (
      <div className="space-y-1.5">
        <label htmlFor={`${idPrefix}-text`} className="block text-xs text-sea-800">
          Paste the address they sent
        </label>
        <textarea
          id={`${idPrefix}-text`}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onPaste={(event) => {
            // Pasting into an empty box is the whole job, so do it straight
            // away rather than waiting for the button.
            if (text.trim()) return;
            const pasted = event.clipboardData.getData("text");
            if (!pasted.trim()) return;
            event.preventDefault();
            fill(pasted);
          }}
          rows={4}
          placeholder={"Nama: …\nNo HP: 0812…\nAlamat: Jl. …, Kel. …, Kec. …, Kota …"}
          className="input text-sm"
        />
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              setPasting(false);
              setEditing(true);
            }}
            className="text-xs text-sea-800 underline"
          >
            Type it in instead
          </button>
          <div className="flex items-center gap-2">
            {pasting && (
              <button
                type="button"
                onClick={() => setPasting(false)}
                className="text-xs text-sea-800 hover:underline"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={() => fill(text)}
              disabled={!text.trim()}
              className="flex items-center gap-1.5 rounded-lg border border-sea-800 px-2.5 py-1 text-xs text-sea-800 hover:bg-sea-50 disabled:opacity-40"
            >
              <ClipboardPaste className="h-3.5 w-3.5" /> Fill in
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="space-y-2">
        <AddressFields value={value} onChange={onChange} idPrefix={idPrefix} />
        <div className="flex justify-between">
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setPasting(true);
            }}
            className="text-xs text-sea-800 underline"
          >
            Paste instead
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-xs font-medium text-sea-800 underline"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  const area = areaSummary(value);

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-sea-200 bg-sea-50 px-3 py-2 text-xs leading-relaxed">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0">
            <strong className="text-sm text-ink">{value.recipient_name || "No name"}</strong>
            {value.phone && <span className="text-sea-800"> · {value.phone}</span>}
          </p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex shrink-0 items-center gap-1 text-sea-800 hover:underline"
          >
            <Pencil className="h-3 w-3" /> Edit
          </button>
        </div>
        {value.line1 && <p>{value.line1}</p>}
        {value.line2 && <p className="text-sea-800">{value.line2}</p>}
        {area && (
          <p className="flex items-start gap-1 text-sea-800">
            <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
            {area}
          </p>
        )}
        {looking && <p className="mt-1 text-sea-800">Finding the area…</p>}
      </div>

      {areas.length > 0 && (
        <div>
          <p className="mb-1 text-xs text-sea-800">Which area is it?</p>
          <div className="space-y-1">
            {areas.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  onChange(withArea(value, option));
                  setAreas([]);
                }}
                className="block w-full rounded-lg border border-sea-200 px-2 py-1.5 text-left text-xs hover:border-sea-400 hover:bg-sea-50"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {missing.length > 0 && (
        <p className="text-xs text-amber-800">
          Could not find the {missing.join(", ")} — tap Edit to add{" "}
          {missing.length === 1 ? "it" : "them"}, or save now and fill in later.
        </p>
      )}

      <button
        type="button"
        onClick={() => setPasting(true)}
        className="text-xs text-sea-800 underline"
      >
        Paste a different address
      </button>
    </div>
  );
}
