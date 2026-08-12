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
drop the files in here and run:

```bash
npm run fonts:convert
```

That writes a `.woff2` next to each one and leaves the originals alone. In
testing it cut a 92 KB `.ttf` to 35 KB — 62% smaller, identical rendering.

It needs Python with two packages, once:

```bash
pip install fonttools brotli
```

If you would rather not touch a terminal, <https://transfonter.org> does the
same job in a browser without uploading anywhere.

**Check your licence before converting.** Most retail font licences cover
webfont use, but some sell desktop and web as separate licences, and a few
forbid conversion. Worth two minutes now rather than a letter later.

## Which files you need

Only the weights the site actually uses. Every extra weight is another file
every visitor downloads.

This site uses **regular (400)**, **medium (500)** and **bold (700)**. If you
only own regular and bold, that is fine — say so and the site will be set to
what you have. Do not point two weights at the same file: the browser
synthesises a passable bold on its own, and a fake bold looks better than a
wrong one.

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
