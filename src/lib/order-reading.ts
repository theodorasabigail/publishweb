import { parsePastedAddress, type ParsedAddress } from "@/lib/parse-address";
import type { SalesChannel } from "@/lib/types";

/**
 * An order as read out of a message, before anyone has checked it.
 *
 * Deliberately loose: every field can be missing, because messages are. The
 * till fills in what is here and the operator does the rest. Item ids are
 * always ones that exist in the catalogue -- anything that could not be
 * matched is kept, as written, in `unmatched`, so it is seen rather than lost.
 */
export interface ReadOrder {
  customerName: string;
  phone: string;
  email: string;
  channel: SalesChannel | null;
  /** The phone number or @handle to find the conversation again by. */
  reference: string;
  items: { variantId: string; quantity: number; asWritten: string }[];
  unmatched: string[];
  /** true ship, false collecting, null not said. */
  ships: boolean | null;
  address: ParsedAddress;
  shippingIdr: number | null;
  /** true already paid, false not yet, null not said. */
  paid: boolean | null;
  paymentMethod: "cash" | "qris" | "card" | "transfer" | null;
  note: string;
  /** YYYY-MM-DD, or "". */
  shipAfter: string;
}

export interface CatalogueEntry {
  variantId: string;
  productName: string;
  size: string;
  priceIdr: number;
  available: number;
}

/**
 * Split a paste that holds several orders.
 *
 * WhatsApp's own "copy" puts each message on a line starting "[12/10 14:03]
 * Name:"; people copying by hand leave blank lines or a row of dashes. Either
 * is a boundary. With none of those, it is one order.
 */
export function splitMessages(text: string): string[] {
  const trimmed = text.replace(/\r/g, "").trim();
  if (!trimmed) return [];
  const parts = trimmed
    .split(/\n\s*(?:-{3,}|={3,}|_{3,})\s*\n|\n\s*\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length ? parts : [trimmed];
}

/** Lower-case, accents off, punctuation to spaces. */
function plain(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** "200g", "200 gr", "0.2kg", "1 kilo" all to grams, for matching sizes. */
function grams(value: string): number | null {
  const match = plain(value).match(/(\d+(?:\s\d+)?)\s?(kg|kilo|g|gr|gram)\b/);
  if (!match) return null;
  const number = Number(match[1].replace(" ", "."));
  return /k/.test(match[2]) ? number * 1000 : number;
}

/** Greetings, payment talk and pickup arrangements: never part of an address. */
const CHAT =
  /\b(halo|hai|hi|kak|ka|mau|pesan|order|beli|transfer|tf|bayar|lunas|bukti|makasih|terima kasih|thanks|ambil|pickup|ya|dong|nih)\b/;

const QTY_WORDS: Record<string, number> = {
  satu: 1, se: 1, sebungkus: 1, dua: 2, tiga: 3, empat: 4, lima: 5,
  enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10,
  one: 1, two: 2, three: 3, four: 4, five: 5,
};

/**
 * Without AI: find catalogue coffees named in the message, with a size and a
 * count near them. Good on tidy messages ("Gayo 200g x2"), and honest about
 * the rest -- lines that mention a size but match no coffee are reported as
 * unmatched instead of guessed.
 */
export function readOrderBasic(text: string, catalogue: CatalogueEntry[]): ReadOrder {
  const items = new Map<string, { variantId: string; quantity: number; asWritten: string }>();
  const unmatched: string[] = [];
  // Lines that are about the coffee or the conversation, kept out of the
  // address so "ambil di toko aja" never becomes a street.
  const notAddress = new Set<string>();

  const products = Array.from(new Set(catalogue.map((entry) => entry.productName)));

  for (const rawLine of text.replace(/\r/g, "").split("\n")) {
    const line = plain(rawLine);
    if (!line) continue;
    // Address and contact lines can contain a coffee's name ("Jl. Gayo") but
    // are never an item.
    if (/^(alamat|jl|jln|jalan|kel|kelurahan|kec|kecamatan|kota|kab|kabupaten|prov|provinsi|kode pos|nama|penerima|no hp|hp|wa|telp)\b/.test(line)) {
      continue;
    }

    // The longest product name that appears, by its distinctive words.
    const product = products
      .filter((name) => {
        const words = plain(name).split(" ").filter((word) => word.length >= 4);
        return words.length > 0 && words.some((word) => line.includes(word));
      })
      .sort((a, b) => b.length - a.length)[0];

    const size = grams(rawLine);
    if (product || CHAT.test(line)) notAddress.add(rawLine);
    if (!product) {
      if (size && !/alamat|jl|jalan|rt|rw|kode/.test(line)) unmatched.push(rawLine.trim());
      continue;
    }

    const sizes = catalogue.filter((entry) => entry.productName === product);
    const variant =
      (size !== null ? sizes.find((entry) => grams(entry.size) === size) : undefined) ??
      (sizes.length === 1 ? sizes[0] : undefined);
    if (!variant) {
      unmatched.push(rawLine.trim());
      continue;
    }

    // "x2", "2x", "2 pcs", "2 bungkus", "dua"; the size's own number is not a count.
    const withoutSize = line.replace(/\d+(?:\s\d+)?\s?(kg|kilo|g|gr|gram)\b/, " ");
    const count =
      withoutSize.match(/(?:x\s?|qty\s?|jumlah\s?)(\d{1,3})\b/)?.[1] ??
      withoutSize.match(/\b(\d{1,3})\s?(?:x|pcs|pc|bks|bungkus|pack|bag|buah)\b/)?.[1] ??
      withoutSize.match(/\b(\d{1,2})\b/)?.[1];
    const word = withoutSize.split(" ").find((token) => token in QTY_WORDS);
    const quantity = Math.max(1, Number(count ?? (word ? QTY_WORDS[word] : 1)));

    const existing = items.get(variant.variantId);
    items.set(variant.variantId, {
      variantId: variant.variantId,
      quantity: (existing?.quantity ?? 0) + quantity,
      asWritten: rawLine.trim(),
    });
  }

  const parsed = parsePastedAddress(
    text
      .replace(/\r/g, "")
      .split("\n")
      .filter((line) => !notAddress.has(line))
      .join("\n"),
  );

  const lower = plain(text);
  const paid = /\b(sudah|udah|dah|sdh|already)\s?(di)?\s?(transfer|tf|bayar|paid|lunas)|\blunas\b|\bpaid\b|bukti\s?(tf|transfer)/.test(lower)
    ? true
    : /\b(belum|blm)\s?(transfer|tf|bayar)|\bcod\b/.test(lower)
      ? false
      : null;
  const ships = /\b(ambil|pickup|pick up|diambil)\b/.test(lower)
    ? false
    : parsed.line1 || parsed.city || /\b(kirim|ongkir|antar)\b/.test(lower)
      ? true
      : null;
  // Collecting: keep who it is for, drop anything that looked like a place.
  const address =
    ships === false
      ? { ...parsed, line1: "", line2: "", village: "", district: "", city: "", province: "", postal_code: "" }
      : parsed;

  return {
    customerName: address.recipient_name,
    phone: address.phone,
    email: address.email,
    channel: address.phone ? "whatsapp" : null,
    reference: address.phone,
    items: Array.from(items.values()),
    unmatched,
    ships,
    address,
    shippingIdr: null,
    paid,
    paymentMethod: paid ? (/\bqris\b/.test(lower) ? "qris" : /\bcash|tunai\b/.test(lower) ? "cash" : "transfer") : null,
    note: "",
    shipAfter: "",
  };
}
