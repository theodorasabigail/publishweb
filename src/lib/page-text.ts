/**
 * Wording on a page that the operator can rewrite.
 *
 * A page's heading and intro have been editable since 0018. Everything else
 * was English written into a component: the steps on the roasting page, every
 * label in the quote form, the button. Changing "Your name" to "Nama lengkap"
 * meant a developer and a deployment, for a shop whose customers mostly do not
 * read English.
 *
 * Each slot below is a default and a name for it. The default is what ships,
 * and what the admin shows as placeholder text -- so an operator can always
 * see the wording they would get by leaving a box empty, and clearing a box is
 * how you go back to it. Nothing here can produce an empty label.
 *
 * Keys are stable strings rather than positions. Reordering this list, or
 * adding to it, must never silently repoint an override at a different phrase.
 */

export interface CopySlot {
  key: string;
  /** What to call this in the admin. */
  label: string;
  /** The wording the page ships with. */
  value: string;
  multiline?: boolean;
  /** Groups the slots into sections in the admin. */
  section: string;
  hint?: string;
}

const ROASTING: CopySlot[] = [
  { section: "The page", key: "kicker", label: "Small label above the heading", value: "Jasa Roasting" },

  { section: "How it works", key: "step1_title", label: "Step 1 — title", value: "Tell us what you have" },
  {
    section: "How it works",
    key: "step1_body",
    label: "Step 1 — text",
    value: "Origin, process, how many kilos, and the roast level you are after.",
    multiline: true,
  },
  { section: "How it works", key: "step2_title", label: "Step 2 — title", value: "We quote you" },
  {
    section: "How it works",
    key: "step2_body",
    label: "Step 2 — text",
    value:
      "Usually within one working day, by WhatsApp or email — whichever you prefer.",
    multiline: true,
  },
  { section: "How it works", key: "step3_title", label: "Step 3 — title", value: "Send the beans" },
  {
    section: "How it works",
    key: "step3_body",
    label: "Step 3 — text",
    value:
      "Drop them off or ship them to the roastery. We sample-roast first on larger lots.",
    multiline: true,
  },
  { section: "How it works", key: "step4_title", label: "Step 4 — title", value: "Collect, roasted" },
  {
    section: "How it works",
    key: "step4_body",
    label: "Step 4 — text",
    value: "Bagged, degassed, and labelled with the roast date.",
    multiline: true,
  },

  {
    section: "WhatsApp nudge",
    key: "whatsapp_before",
    label: "Before the link",
    value: "Wholesale or a standing order?",
    hint: "Only shown when a WhatsApp number is set in Site settings.",
  },
  { section: "WhatsApp nudge", key: "whatsapp_link", label: "The link itself", value: "Message us on WhatsApp" },
  { section: "WhatsApp nudge", key: "whatsapp_after", label: "After the link", value: "and we will talk it through." },

  { section: "The quote form", key: "form_title", label: "Form heading", value: "Request a quote" },
  {
    section: "The quote form",
    key: "form_intro",
    label: "Under the heading",
    value: "No commitment. We will come back with a price and a timeline.",
    multiline: true,
  },
  { section: "The quote form", key: "field_name", label: "Name — label", value: "Your name" },
  { section: "The quote form", key: "field_phone", label: "Phone — label", value: "WhatsApp / phone" },
  { section: "The quote form", key: "field_phone_placeholder", label: "Phone — placeholder", value: "+62…" },
  { section: "The quote form", key: "field_email", label: "Email — label", value: "Email" },
  { section: "The quote form", key: "field_origin", label: "Green beans — label", value: "Green bean origin" },
  {
    section: "The quote form",
    key: "field_origin_placeholder",
    label: "Green beans — placeholder",
    value: "e.g. Gayo, natural process",
  },
  { section: "The quote form", key: "field_quantity", label: "Quantity — label", value: "Quantity (kg)" },
  { section: "The quote form", key: "field_roast", label: "Roast level — label", value: "Roast level" },
  { section: "The quote form", key: "field_roast_empty", label: "Roast level — first option", value: "Choose…" },
  {
    section: "The quote form",
    key: "roast_levels",
    label: "Roast levels offered",
    value: "Light\nLight-Medium\nMedium\nMedium-Dark\nDark\nNot sure — advise me",
    multiline: true,
    hint: "One per line. These are what the customer picks from.",
  },
  { section: "The quote form", key: "field_notes", label: "Notes — label", value: "Anything else" },
  {
    section: "The quote form",
    key: "field_notes_placeholder",
    label: "Notes — placeholder",
    value: "Target profile, packaging, deadline…",
  },
  { section: "The quote form", key: "submit", label: "Button", value: "Send request" },
  { section: "The quote form", key: "submitting", label: "Button while sending", value: "Sending…" },

  { section: "After sending", key: "sent_title", label: "Heading", value: "Request sent" },
  {
    section: "After sending",
    key: "sent_body",
    label: "Text",
    value: "We normally reply within one working day.",
    multiline: true,
    hint: "The reference number is shown above this automatically.",
  },
];

/** Every page whose wording can be rewritten, and the slots it offers. */
export const PAGE_TEXT: Record<string, CopySlot[]> = {
  roasting: ROASTING,
};

export function copySlotsFor(slug: string): CopySlot[] {
  return PAGE_TEXT[slug] ?? [];
}

export type PageCopyOverrides = Record<string, string> | null | undefined;

/**
 * Resolve one page's wording.
 *
 * Returns a lookup rather than a merged object so a caller cannot silently ask
 * for a slot that does not exist: an unknown key returns an empty string and
 * shows up as missing text, rather than as `undefined` rendered into the page.
 */
export function pageText(slug: string, overrides: PageCopyOverrides) {
  const slots = copySlotsFor(slug);

  return function text(key: string): string {
    const override = overrides?.[key];
    if (typeof override === "string" && override.trim().length) {
      return override.trim();
    }
    return slots.find((slot) => slot.key === key)?.value ?? "";
  };
}

/** A multiline slot read as a list — one entry per non-empty line. */
export function textLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
