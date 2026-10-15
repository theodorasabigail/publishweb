/**
 * Indonesian phone numbers, compared the way people mean them.
 *
 * The same number reaches the shop as 0812-3456-7890, +62 812 3456 7890,
 * 62812 34567890 or (0812) 3456.7890 -- typed into a profile, an address, a
 * WhatsApp reference, a checkout form. All of them share one core, the part
 * after the country code or the leading zero: 81234567890. Two numbers are
 * the same when their cores are.
 */

/** 0812-3456-7890, +62 812 3456 7890 and 6281234567890 all give 81234567890. */
export function phoneCore(raw: string | null | undefined): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  // Only a whole number carries a country code; "6234" typed into a search box
  // is a fragment, not +62 followed by 34.
  if (digits.startsWith("62") && digits.length >= 9) return digits.slice(2);
  if (digits.startsWith("0")) return digits.slice(1);
  return digits;
}

/**
 * Long enough to be a whole number rather than a fragment of one. Indonesian
 * numbers have at least nine digits after the 0 or 62 (mobiles 9-12, landlines
 * like 022-1234567 nine), so eight or fewer is someone searching for a part.
 */
export function isWholeNumber(raw: string | null | undefined): boolean {
  return phoneCore(raw).length >= 9;
}

/**
 * Whether a stored number matches what was typed.
 *
 * A whole number has to match exactly -- 0812-3456-7890 is not 0812-3456-78901.
 * A fragment ("3456-7890", "0812 34") matches any number containing it, which
 * is what a search box is for.
 */
export function phoneMatches(stored: string | null | undefined, typed: string): boolean {
  const want = phoneCore(typed);
  const have = phoneCore(stored);
  if (!want || !have) return false;
  return isWholeNumber(typed) ? have === want : have.includes(want);
}

/**
 * A LIKE pattern that finds the digits whatever sits between them -- dashes,
 * spaces, dots, a +62 in front. Deliberately loose: it narrows the rows the
 * database sends back, and phoneMatches then decides exactly.
 */
export function phoneLikePattern(typed: string): string {
  return `%${phoneCore(typed).split("").join("%")}%`;
}
