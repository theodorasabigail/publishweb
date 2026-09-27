/**
 * Turn an address pasted out of a chat into the fields an order needs.
 *
 * Customers send their address however they like: a neat "Nama: / No HP: /
 * Alamat:" block, a marketplace export, or four loose lines with the phone
 * number in the middle. Retyping that into eight boxes is most of what made a
 * WhatsApp order slow to write down, so this does the first pass and the
 * operator checks the result.
 *
 * Deliberately a guesser, not a validator. It never throws and never refuses:
 * whatever it cannot place stays in the street line, where the operator will
 * see it, rather than being dropped. The administrative half (kelurahan,
 * kecamatan, city, province, postcode) is only a starting point — the till
 * then asks the courier's area list for the real thing.
 */

export interface ParsedAddress {
  recipient_name: string;
  phone: string;
  email: string;
  line1: string;
  line2: string;
  village: string;
  district: string;
  city: string;
  province: string;
  postal_code: string;
}

type Field = keyof ParsedAddress | "address" | "note";

/** Labels people actually type, longest first so "no hp" beats "no". */
const LABELS: [RegExp, Field][] = [
  [/^(nama\s*(lengkap|penerima)?|penerima|atas\s*nama|a\.?\s*n\.?|name|recipient)$/, "recipient_name"],
  [
    /^((no\.?|nomor|nmr)\s*)?(hp|h\.p\.?|telp\.?|telepon|tlp|wa|whatsapp|handphone|ponsel|phone|kontak)$|^(no\.?|nomor)$/,
    "phone",
  ],
  [/^(e-?mail|surel)$/, "email"],
  [/^(alamat(\s*(lengkap|pengiriman|rumah|kirim))?|address|jalan|jl\.?)$/, "address"],
  [/^(kel\.?|kelurahan|desa|ds\.?|kel\s*\/\s*desa|kelurahan\s*\/\s*desa)$/, "village"],
  [/^(kec\.?|kecamatan)$/, "district"],
  [/^(kota|kab\.?|kabupaten|kota\s*\/\s*kab(upaten)?\.?|kab(upaten)?\s*\/\s*kota|city)$/, "city"],
  [/^(prov\.?|provinsi|propinsi|province)$/, "province"],
  [/^(kode\s*pos|kodepos|kd\.?\s*pos|k\.?\s*pos|zip|postal(\s*code)?|postcode)$/, "postal_code"],
  [/^(rt\s*\/?\s*rw|patokan|catatan|note|ket\.?|keterangan|detail)$/, "note"],
];

/**
 * Provinces, and the short names people write instead. Matched as whole
 * words at the end of the address, which is where they always are.
 */
const PROVINCES: [RegExp, string][] = [
  [/\b(dki\s*jakarta|dki|jakarta)\b/i, "DKI Jakarta"],
  [/\b(jawa\s*barat|jabar)\b/i, "Jawa Barat"],
  [/\b(jawa\s*tengah|jateng)\b/i, "Jawa Tengah"],
  [/\b(jawa\s*timur|jatim)\b/i, "Jawa Timur"],
  [/\b(d\.?\s*i\.?\s*y\.?|daerah\s*istimewa\s*yogyakarta|di\s*yogyakarta)\b/i, "DI Yogyakarta"],
  [/\bbanten\b/i, "Banten"],
  [/\bbali\b/i, "Bali"],
  [/\b(nusa\s*tenggara\s*barat|ntb)\b/i, "Nusa Tenggara Barat"],
  [/\b(nusa\s*tenggara\s*timur|ntt)\b/i, "Nusa Tenggara Timur"],
  [/\b(nanggroe\s*aceh\s*darussalam|aceh|nad)\b/i, "Aceh"],
  [/\b(sumatera|sumatra)\s*utara\b|\bsumut\b/i, "Sumatera Utara"],
  [/\b(sumatera|sumatra)\s*barat\b|\bsumbar\b/i, "Sumatera Barat"],
  [/\b(sumatera|sumatra)\s*selatan\b|\bsumsel\b/i, "Sumatera Selatan"],
  [/\briau\b(?!\s*kep)/i, "Riau"],
  [/\b(kepulauan\s*riau|kepri)\b/i, "Kepulauan Riau"],
  [/\bjambi\b/i, "Jambi"],
  [/\bbengkulu\b/i, "Bengkulu"],
  [/\blampung\b/i, "Lampung"],
  [/\b(kepulauan\s*bangka\s*belitung|bangka\s*belitung|babel)\b/i, "Kepulauan Bangka Belitung"],
  [/\bkalimantan\s*barat\b|\bkalbar\b/i, "Kalimantan Barat"],
  [/\bkalimantan\s*tengah\b|\bkalteng\b/i, "Kalimantan Tengah"],
  [/\bkalimantan\s*selatan\b|\bkalsel\b/i, "Kalimantan Selatan"],
  [/\bkalimantan\s*timur\b|\bkaltim\b/i, "Kalimantan Timur"],
  [/\bkalimantan\s*utara\b|\bkaltara\b/i, "Kalimantan Utara"],
  [/\bsulawesi\s*utara\b|\bsulut\b/i, "Sulawesi Utara"],
  [/\bsulawesi\s*tengah\b|\bsulteng\b/i, "Sulawesi Tengah"],
  [/\bsulawesi\s*selatan\b|\bsulsel\b/i, "Sulawesi Selatan"],
  [/\bsulawesi\s*tenggara\b|\bsultra\b/i, "Sulawesi Tenggara"],
  [/\bsulawesi\s*barat\b|\bsulbar\b/i, "Sulawesi Barat"],
  [/\bgorontalo\b/i, "Gorontalo"],
  [/\bmaluku\s*utara\b|\bmalut\b/i, "Maluku Utara"],
  [/\bmaluku\b/i, "Maluku"],
  [/\bpapua\s*barat\s*daya\b/i, "Papua Barat Daya"],
  [/\bpapua\s*barat\b/i, "Papua Barat"],
  [/\bpapua\s*tengah\b/i, "Papua Tengah"],
  [/\bpapua\s*pegunungan\b/i, "Papua Pegunungan"],
  [/\bpapua\s*selatan\b/i, "Papua Selatan"],
  [/\bpapua\b/i, "Papua"],
];

/** An Indonesian mobile number however it was written: 0812…, +62 812…, 62-812…. */
const PHONE = /(?:\+?62|\b0)[\s.-]?8[\d\s.-]{7,15}\d/;
const EMAIL = /[^\s@,;:<>()]+@[^\s@,;:<>()]+\.[a-z]{2,}/i;
const POSTAL = /\b\d{5}\b/;
const RT_RW = /\bRT\.?\s*:?\s*0*\d{1,3}\s*(?:[\/,]?\s*RW\.?\s*:?\s*0*\d{1,3})?\b|\bRW\.?\s*:?\s*0*\d{1,3}\b/i;

/** Inline markers inside a one-line address: "Kel. Sukajadi", "Kec Sukasari". */
const INLINE: [RegExp, "village" | "district" | "city"][] = [
  [/\b(?:kel(?:urahan)?|desa|ds)\.?\s+([^,\n]+)/i, "village"],
  [/\b(?:kec(?:amatan)?)\.?\s+([^,\n]+)/i, "district"],
  [/\b((?:kota|kab(?:upaten)?)\.?\s+[^,\n]+)/i, "city"],
];

function tidy(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/^[\s,;.:\-–—]+|[\s,;:\-–—]+$/g, "")
    .trim();
}

/** 0812…, the way the shop writes numbers, from any of the usual spellings. */
export function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("62")) return `0${digits.slice(2)}`;
  if (digits.startsWith("8")) return `0${digits}`;
  return digits;
}

function titleCase(value: string): string {
  // Only shout-case gets fixed. "McDonald" or "de Jong" typed carefully stay
  // as they were typed.
  if (value !== value.toUpperCase()) return value;
  return value.toLowerCase().replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}

/** "Kota Bandung" -> "Bandung"; "Kab. Sleman" -> "Kabupaten Sleman". */
function cleanCity(value: string): string {
  const trimmed = tidy(value);
  const kab = trimmed.match(/^kab(?:upaten)?\.?\s+(.+)$/i);
  if (kab) return `Kabupaten ${titleCase(tidy(kab[1]))}`;
  const kota = trimmed.match(/^kota\.?\s+(.+)$/i);
  if (kota) return titleCase(tidy(kota[1]));
  return titleCase(trimmed);
}

function stripLeader(line: string): string {
  // Bullets, numbering and the emoji people decorate forms with.
  return line.replace(/^[\s\-–—•*·>#\d.)]*(?=\p{L})/u, "").replace(/^[^\p{L}\p{N}+]+/u, "");
}

export function parsePastedAddress(text: string): ParsedAddress {
  const out: ParsedAddress = {
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
  };

  const street: string[] = [];
  const notes: string[] = [];
  const loose: string[] = [];

  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = stripLeader(raw).trim();
    if (!line) continue;

    const labelled = line.match(/^([\p{L}\s./]{1,30}?)\s*[:=]\s*(.*)$/u);
    const field = labelled
      ? LABELS.find(([pattern]) => pattern.test(labelled[1].trim().toLowerCase()))?.[1]
      : undefined;

    if (!labelled || !field) {
      // "Kirim ke:", "Data pengiriman:" -- a heading with nothing after it.
      if (labelled && !labelled[2].trim()) continue;
      loose.push(line);
      continue;
    }

    const value = tidy(labelled[2]);
    if (!value) continue;

    if (field === "address") street.push(value);
    else if (field === "note") notes.push(value);
    else if (field === "phone") out.phone ||= value;
    else if (!out[field]) out[field] = value;
  }

  // Loose lines: the name is usually the first line with no digits that is
  // short enough to be a name; everything else is address.
  for (const line of loose) {
    let rest = line;

    const phone = rest.match(PHONE);
    if (phone) {
      out.phone ||= phone[0];
      // "Rina (0812…)" or "Rina - 0812…": the words in front are the name.
      const before = tidy(rest.slice(0, phone.index).replace(/[(\[]\s*$/, ""));
      rest = tidy(rest.slice(0, phone.index) + rest.slice((phone.index ?? 0) + phone[0].length))
        .replace(/[()\[\]]/g, "")
        .trim();
      if (before && !out.recipient_name && !/\d/.test(before) && before.split(" ").length <= 5) {
        out.recipient_name = before;
        rest = tidy(rest.slice(before.length));
      }
      if (!rest) continue;
    }

    const email = rest.match(EMAIL);
    if (email) {
      out.email ||= email[0];
      rest = tidy(rest.replace(email[0], ""));
      if (!rest) continue;
    }

    if (
      !out.recipient_name &&
      !street.length &&
      !/\d/.test(rest) &&
      rest.split(/\s+/).length <= 5 &&
      !/^(jl|jln|jalan|gg|gang|perum|komplek|kompleks|blok|dusun|dsn|rt|rw)\b/i.test(rest)
    ) {
      out.recipient_name = rest;
      continue;
    }

    street.push(rest);
  }

  let address = street.join(", ");

  if (!out.email) {
    const email = address.match(EMAIL);
    if (email) {
      out.email = email[0];
      address = address.replace(email[0], "");
    }
  }

  if (!out.phone) {
    const phone = address.match(PHONE);
    if (phone) {
      out.phone = phone[0];
      address = address.replace(phone[0], "");
    }
  }

  if (!out.postal_code) {
    const postal = address.match(POSTAL);
    if (postal) {
      out.postal_code = postal[0];
      address = address.replace(postal[0], "");
    }
  } else {
    out.postal_code = out.postal_code.match(POSTAL)?.[0] ?? out.postal_code;
  }

  const rtrw = address.match(RT_RW);
  if (rtrw) {
    notes.unshift(tidy(rtrw[0]).toUpperCase().replace(/\s+/g, " "));
    address = address.replace(rtrw[0], "");
  }

  for (const [pattern, field] of INLINE) {
    const match = address.match(pattern);
    if (!match) continue;
    if (!out[field]) out[field] = tidy(match[1]);
    address = address.replace(match[0], "");
  }

  if (!out.province) {
    // From the end: "Jl. Jakarta No. 3, Bandung, Jawa Barat" is in Jawa Barat.
    const parts = address.split(",").map(tidy).filter(Boolean);
    for (let index = parts.length - 1; index >= 0 && !out.province; index--) {
      for (const [pattern, name] of PROVINCES) {
        const match = parts[index].match(pattern);
        // Only when the part is essentially just the province, so a street
        // named after one ("Jl. Bali No. 4") is left alone.
        if (match && tidy(parts[index].replace(match[0], "")).length <= 2) {
          out.province = name;
          parts.splice(index, 1);
          break;
        }
      }
    }
    address = parts.join(", ");
  }

  // With no "Kota" marker, the last short part left is usually the city.
  if (!out.city) {
    const parts = address.split(",").map(tidy).filter(Boolean);
    const last = parts.at(-1);
    if (parts.length > 1 && last && !/\d/.test(last) && last.split(" ").length <= 3) {
      out.city = last;
      parts.pop();
      address = parts.join(", ");
    }
  }

  out.line1 = tidy(
    address
      .split(",")
      .map(tidy)
      .filter(Boolean)
      .join(", "),
  );
  out.line2 = tidy(notes.join(", "));
  out.recipient_name = titleCase(tidy(out.recipient_name));
  out.phone = out.phone ? normalisePhone(out.phone) : "";
  out.email = out.email.toLowerCase();
  out.village = titleCase(tidy(out.village));
  out.district = titleCase(tidy(out.district));
  out.city = out.city ? cleanCity(out.city) : "";
  out.province = out.province ? titleCase(tidy(out.province)) : "";

  return out;
}

/** What to ask the courier's area list, from whatever the paste gave us. */
export function areaQuery(parsed: ParsedAddress): string {
  const place = parsed.village || parsed.district;
  if (place && parsed.city) return `${place} ${parsed.city.replace(/^Kabupaten\s+/, "")}`;
  if (place) return place;
  if (parsed.postal_code) return parsed.postal_code;
  return parsed.city;
}
