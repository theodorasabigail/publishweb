/**
 * Site typography — the only file that names a typeface.
 *
 * Tailwind maps `font-sans` and `font-serif` onto the CSS variables
 * `--font-sans` / `--font-serif`, and `globals.css` resolves both from
 * `--font-brand`. So switching the site's font is this file and nothing else.
 *
 * ---------------------------------------------------------------------------
 * TO ADD THE BRAND FONT
 *
 * 1. Put the font files in `src/fonts/` (see the README there).
 * 2. If they are .otf or .ttf, run `npm run fonts:convert` to make .woff2.
 * 3. Uncomment the block below and list the weights you actually have.
 * 4. Change `fontClassNames` at the bottom to `brandFont.variable`.
 *
 * Step 3 must come after step 1 — next/font resolves the files at build time,
 * so pointing at a font that is not in the repo fails every deploy.
 * ---------------------------------------------------------------------------
 */

// import localFont from "next/font/local";
//
// export const brandFont = localFont({
//   // One entry per weight you own. Drop any you do not have rather than
//   // pointing two weights at the same file — the browser can synthesise a
//   // bold, and a fake bold looks better than a wrong one.
//   //
//   // A variable font needs a single entry with a range instead:
//   //   { path: "../fonts/YourFont-VF.woff2", weight: "400 700", style: "normal" }
//   src: [
//     { path: "../fonts/YourFont-Regular.woff2", weight: "400", style: "normal" },
//     { path: "../fonts/YourFont-Medium.woff2",  weight: "500", style: "normal" },
//     { path: "../fonts/YourFont-Bold.woff2",    weight: "700", style: "normal" },
//   ],
//   variable: "--font-brand",
//   // Show fallback text immediately rather than invisible text while loading.
//   display: "swap",
//   // Next matches the fallback's metrics to the real font, so headings do not
//   // visibly reflow when it arrives. Set this to whichever of Arial or
//   // "Times New Roman" is closer in proportion to your font.
//   adjustFontFallback: "Arial",
// });

// ---------------------------------------------------------------------------
// Admin dashboard
// ---------------------------------------------------------------------------

import {
  Archivo,
  Fraunces,
  IBM_Plex_Sans,
  Instrument_Serif,
  Newsreader,
} from "next/font/google";

/**
 * The dashboard's typeface, which is deliberately not the shop's.
 *
 * The storefront is a brand; the dashboard is a tool someone reads for an hour
 * at a time, in small sizes, with a lot of numbers. Those want different
 * things, so they get different fonts rather than one compromise.
 *
 * IBM Plex Sans is drawn for interfaces: open apertures, unambiguous 1/l/I,
 * and it holds up at 13px where a display face falls apart. Choosing anything
 * here is a one-line change — the name below is the only place it appears.
 *
 * Self-hosted by next/font at build time, so there is no request to Google
 * from a visitor's browser and nothing to slow the first paint.
 */
export const adminFont = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-admin",
  display: "swap",
});

// ---------------------------------------------------------------------------
// The Journal
// ---------------------------------------------------------------------------

/*
 * A magazine wants two typefaces doing two different jobs, and the shop's
 * single face cannot do both: headlines want personality at 60px, body wants
 * to disappear at 19px for a thousand words. So the journal gets a pair, and
 * only the journal loads them -- the shop and the checkout are untouched.
 *
 * Both are variable fonts with an optical size axis, which is the thing that
 * makes them read as typeset rather than as scaled: the letterforms genuinely
 * differ between a headline and a caption instead of being the same drawing at
 * two sizes.
 */

/** Headlines. High contrast, a little eccentric, unmistakably not a default. */
export const displayFont = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});

/** Body copy. Drawn for screen reading at length. */
export const readingFont = Newsreader({
  subsets: ["latin"],
  variable: "--font-read",
  display: "swap",
  style: ["normal", "italic"],
  axes: ["opsz"],
});

/**
 * Put on the wrapper of every journal page, alongside the `journal` class.
 *
 * next/font defines its CSS variables on whichever element carries these, so
 * the two faces resolve inside the journal and nowhere else -- which is also
 * what keeps the shop from downloading them.
 */
export const journalFontClassNames = `${displayFont.variable} ${readingFont.variable}`;

// ---------------------------------------------------------------------------
// The shop
// ---------------------------------------------------------------------------

/*
 * Until now the storefront was the one part of this site with no typeface at
 * all. The journal had two, the dashboard had one, and the shop -- the pages
 * people actually look at -- fell through to Georgia and whatever sans the
 * operating system happened to offer. Every "large, tight, uppercase" heading
 * in the block library was rendering in Georgia, which is why the result kept
 * reading as a document rather than as a shop.
 *
 * These two are placeholders with a job: hold the design honestly until the
 * Publish font arrives. The moment `brandFont` is wired up it takes over both
 * roles, because the variables below resolve through `--font-brand` first.
 */

/** Headlines. High-contrast, narrow, and it gets better the larger it is set —
 *  which is what makes a 90px page title look intended rather than zoomed. */
export const displayFace = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-display-shop",
  display: "swap",
});

/** Everything else. A grotesque that holds its shape at 11px with wide
 *  letterspacing, which is the whole navigation and every label on the site. */
export const uiFace = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ui",
  display: "swap",
});

/**
 * Applied to <html> in the root layout, so both faces are available site-wide.
 *
 * `globals.css` still resolves `--font-brand` first, so wiring up the brand
 * font replaces both of these everywhere without touching this line.
 */
export const fontClassNames = `${displayFace.variable} ${uiFace.variable}`;
