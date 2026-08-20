/**
 * The flavour scale.
 *
 * Publish's own six-colour system, used on the packaging. Levels 1–5 run from
 * the cleanest, most delicate cups to the biggest and most intense; 6 is not
 * further along that line but off to one side of it — the heavily processed
 * lots, which are a different kind of experience rather than simply a louder
 * one. That is why purple is a colour and not a darker orange.
 *
 * It exists so a customer can decide without knowing what "anaerobic" means.
 * A washed Ethiopian and a natural Java are not more or less good than each
 * other, they are different experiences, and the colour says which before any
 * of the vocabulary does.
 *
 * The scale is fixed in code rather than editable, deliberately: it is
 * printed on bags. A shop that could drift out of step with the packaging
 * would be worse than no scale at all. What products sit at which level is
 * entirely editable, in the admin.
 */

export interface FlavourLevel {
  level: number;
  label: string;
  hex: string;
  /** Shown to customers as the one-line explanation of what this means. */
  description: string;
}

export const FLAVOUR_LEVELS: FlavourLevel[] = [
  {
    level: 1,
    label: "Delicate",
    hex: "#fbf9fd",
    description: "Clean and gentle. Washed lots, floral and tea-like.",
  },
  {
    level: 2,
    label: "Light",
    hex: "#f7f0a0",
    description: "Bright and easy-going, with soft citrus and sweetness.",
  },
  {
    level: 3,
    label: "Balanced",
    hex: "#f0d055",
    description: "Sweet and rounded. The middle of the range.",
  },
  {
    level: 4,
    label: "Fruity",
    hex: "#e8a02e",
    description: "Ripe and juicy, with the fruit well forward.",
  },
  {
    level: 5,
    label: "Bold",
    hex: "#e07a20",
    description: "Big, syrupy and intense. Naturals at full volume.",
  },
  {
    level: 6,
    label: "Experimental",
    hex: "#c9a4ee",
    description:
      "The most heavily processed lots. Unusual, distinctive, and not for everyone.",
  },
];

export function flavourFor(level: number | null | undefined): FlavourLevel | null {
  if (!level) return null;
  return FLAVOUR_LEVELS.find((entry) => entry.level === level) ?? null;
}

/**
 * Level 1 is very nearly white, so on a white page a plain swatch disappears
 * and reads as a missing image rather than as the lightest step. Every swatch
 * therefore carries a hairline; it is only visible on the pale end, which is
 * exactly where it is needed.
 */
export const FLAVOUR_SWATCH_RING = "1px solid rgba(15, 32, 36, 0.18)";
