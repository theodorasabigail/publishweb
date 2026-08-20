import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const idrFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function formatIDR(amount: number | null | undefined): string {
  return idrFormatter.format(amount ?? 0);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** URL-safe slug. Used by the admin editors so the operator can type a title
 *  and get a sane slug without knowing what a slug is. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function readingMinutes(body: string | null | undefined): number {
  const words = (body ?? "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

const INK = "#0f2024";

/** WCAG relative luminance. Note the gamma step — the eye is not linear in
 *  light, and a plain channel average gets mid-tones wrong in exactly the
 *  range most brand colours live in. */
function relativeLuminance(r: number, g: number, b: number): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * Readable text colour for an operator-chosen accent.
 *
 * Picks whichever of ink or white actually contrasts more, rather than
 * guessing from a brightness threshold. The threshold version got the brand's
 * own steel blue wrong — it read as "dark", so it took white text at 3.7:1,
 * under the 4.5:1 floor. Comparing the two real ratios cannot make that
 * mistake for any colour the operator picks.
 */
export function contrastText(hex: string): "#ffffff" | typeof INK {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return "#ffffff";

  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return "#ffffff";

  const background = relativeLuminance(r, g, b);
  const ratio = (other: number) =>
    (Math.max(background, other) + 0.05) / (Math.min(background, other) + 0.05);

  // White is 1.0; ink is dark enough that its luminance is worth computing
  // once rather than hard-coding a number that drifts if ink changes.
  const inkLuminance = relativeLuminance(0x0f, 0x20, 0x24);
  return ratio(inkLuminance) >= ratio(1) ? INK : "#ffffff";
}

export function isValidHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}
