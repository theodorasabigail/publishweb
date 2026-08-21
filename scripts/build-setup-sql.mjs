/**
 * Build the two files the operator actually pastes.
 *
 *   supabase/setup.sql           the database itself, from supabase/migrations/
 *   supabase/starter-content.sql the starting coffees and copy, from supabase/content/
 *
 * The split is the point. setup.sql describes structure — tables, columns,
 * functions, security — and contains no products, prices, categories or
 * writing. That is what makes it safe to paste again every time the site gains
 * a feature: there is nothing in it that *could* overwrite the operator's work.
 *
 * starter-content.sql is the opposite: it is entirely content, and it is run
 * once on a brand-new project. Running it a second time would re-add coffees
 * that had been deleted, so it says so at the top in the plainest words
 * available.
 *
 * Both are generated. Edit the numbered sources, then `npm run build:sql`.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "supabase");

function collect(dir) {
  const path = join(ROOT, dir);
  const files = readdirSync(path)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  if (!files.length) {
    console.error(`No .sql files in supabase/${dir}.`);
    process.exit(1);
  }

  const body = files
    .map((name) => {
      const sql = readFileSync(join(path, name), "utf8").trimEnd();
      return [
        "-- ===========================================================================",
        `-- ${dir}/${name}`,
        "-- ===========================================================================",
        "",
        sql,
        "",
      ].join("\n");
    })
    .join("\n");

  return { files, body };
}

const setupBanner = `-- ===========================================================================
-- Publish Coffee Roasters -- the database
-- PT Aroma Pulau Arunika
--
-- THIS FILE IS GENERATED. Do not edit it by hand.
-- Edit supabase/migrations/*.sql instead, then run: npm run build:sql
--
-- ---------------------------------------------------------------------------
-- HOW TO USE THIS
--
-- Copy the whole file, paste it into Supabase -> SQL Editor, press Run.
-- You should see "Success. No rows returned."
--
-- Run it whenever the site tells you your database needs updating. Run it
-- again after that, and again -- it is designed to be pasted repeatedly.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS FILE WILL NOT DO
--
-- It contains no coffees, no prices, no categories and no writing. Not "it is
-- careful with them" -- it does not contain them at all, so there is nothing
-- here that could overwrite what you have set up. Everything it does is add
-- structure that is missing and leave alone everything that is already there.
--
-- The one exception is named and bounded: it deletes six placeholder coffees
-- by name, left behind by earlier versions of this project. Those six slugs
-- are written out in full below and cannot match anything real.
--
-- Starting content -- the first coffees, shipping rates and sample posts --
-- lives in supabase/starter-content.sql, which is run once on a brand-new
-- project and never again.
-- ===========================================================================

`;

const contentBanner = `-- ===========================================================================
-- Publish Coffee Roasters -- starting content
-- PT Aroma Pulau Arunika
--
-- THIS FILE IS GENERATED. Do not edit it by hand.
-- Edit supabase/content/*.sql instead, then run: npm run build:sql
--
-- ---------------------------------------------------------------------------
-- RUN THIS ONCE, ON A BRAND-NEW PROJECT, AFTER setup.sql
--
-- It adds the starting coffees, shipping rates, categories and sample journal
-- posts, so a new shop is not an empty one.
--
-- ---------------------------------------------------------------------------
-- DO NOT RUN IT AGAIN
--
-- Every statement here skips rows that already exist, so re-running will not
-- overwrite a price or a heading you have changed. But it WILL bring back a
-- coffee you deliberately deleted, because from its point of view a missing
-- row is a row it has not added yet.
--
-- If you want to update your database, use supabase/setup.sql. That one is
-- built to be run over and over.
-- ===========================================================================

`;

const setup = collect("migrations");
const content = collect("content");

writeFileSync(join(ROOT, "setup.sql"), setupBanner + setup.body);
writeFileSync(join(ROOT, "starter-content.sql"), contentBanner + content.body);

console.log(`setup.sql            <- ${setup.files.length} files`);
for (const name of setup.files) console.log(`  ${name}`);
console.log(`starter-content.sql  <- ${content.files.length} files`);
for (const name of content.files) console.log(`  ${name}`);
