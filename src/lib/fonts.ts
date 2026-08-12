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

/**
 * Applied to <html> in the root layout.
 *
 * Empty until a font is wired up, which is deliberate: `globals.css` resolves
 * `--font-brand` with an inline fallback, so the site renders correct system
 * typography today and switches over the moment this becomes
 * `brandFont.variable`.
 */
export const fontClassNames = "";
