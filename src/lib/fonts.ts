/**
 * Site typography.
 *
 * Two roles, exposed to CSS as variables that `tailwind.config.ts` maps onto
 * `font-sans` and `font-serif`:
 *
 *   --font-sans   body text, buttons, labels, the admin
 *   --font-serif  headings and display text
 *
 * Nothing else in the codebase names a typeface. Changing the site's fonts
 * means changing this file only.
 *
 * ---------------------------------------------------------------------------
 * TO USE YOUR OWN FONT
 *
 * 1. Put the font file in `src/fonts/` (see the README in that folder).
 * 2. Uncomment the `localFont` block below and point `src` at your file.
 * 3. Swap the export at the bottom so it uses your font.
 *
 * The file must actually exist before the build will succeed — next/font
 * resolves it at build time. That is why this ships with system fonts: the
 * site works today, and adding the real font is a small, contained change.
 * ---------------------------------------------------------------------------
 */

// import localFont from "next/font/local";
//
// export const brandFont = localFont({
//   // One entry per weight you own. A single variable font needs only one
//   // entry — add `weight: "300 900"` to declare the range it covers.
//   src: [
//     { path: "../fonts/YourFont-Regular.woff2", weight: "400", style: "normal" },
//     { path: "../fonts/YourFont-Medium.woff2",  weight: "500", style: "normal" },
//     { path: "../fonts/YourFont-Bold.woff2",    weight: "700", style: "normal" },
//   ],
//   variable: "--font-sans",
//   display: "swap",
//   // Text stays visible in a near-identical fallback while the font loads,
//   // so headings do not visibly jump when it arrives.
//   adjustFontFallback: "Arial",
// });

/**
 * Until a font file is added, both roles fall back to the system stack. This
 * is deliberate and honest: previously the CSS *named* Inter and Fraunces
 * without loading them, so the site silently rendered in whatever the visitor
 * happened to have. Naming nothing is better than naming a lie.
 */
export const fontClassNames = "";

export const FONT_STACKS = {
  sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  serif: 'ui-serif, Georgia, Cambria, "Times New Roman", serif',
} as const;
