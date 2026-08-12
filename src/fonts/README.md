# Fonts

Put your font files in this folder, then wire them up in `src/lib/fonts.ts`.

The files are served from your own domain — no request to Google or Adobe, so
nothing about your visitors leaks to a third party and there is no extra
connection to slow the first paint.

## What format to use

**`.woff2` is what you want.** It is roughly 30–50% smaller than the same font
as `.otf` or `.ttf`, and every browser in use today supports it. Given the site
already runs on a metered Supabase/Vercel plan, that difference is worth having.

If your font came as `.otf` or `.ttf` (the formats you install on a computer),
it will still work, but convert it first — <https://transfonter.org> does this
in the browser, for free, without uploading anywhere.

**Check your licence before converting.** Most retail font licences cover
webfont use, but some sell desktop and web as separate licences, and a few
forbid conversion. Worth two minutes now rather than a letter later.

## Which files you need

Only the weights the site actually uses. Every extra weight is another file
every visitor downloads.

This site uses **regular (400)**, **medium (500)** and **bold (700)**. If your
font has a different set, that is fine — tell whoever wires it up and the site
can be adjusted to what you own.

If you have a **variable font** (one file, usually named something like
`YourFont-VF.woff2` or `YourFont[wght].woff2`), that single file covers every
weight and is the best option. Use it.

## Naming

Keep the names the font came with. `YourFont-Regular.woff2`,
`YourFont-Bold.woff2`, and so on. They only need to match what
`src/lib/fonts.ts` points at.

## Italics

Only include an italic file if the design uses italic text. This site currently
does not, so it is usually one less file to ship.
