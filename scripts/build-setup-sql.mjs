/**
 * Concatenate supabase/migrations/*.sql into a single supabase/setup.sql.
 *
 * The numbered migrations stay the source of truth — this file is generated,
 * so the one-paste setup can never drift away from the real schema. Rerun with
 * `npm run build:sql` after adding a migration.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(import.meta.dirname, "..", "supabase", "migrations");
const OUTPUT = join(import.meta.dirname, "..", "supabase", "setup.sql");

const files = readdirSync(MIGRATIONS_DIR)
  .filter((name) => name.endsWith(".sql"))
  .sort();

if (!files.length) {
  console.error("No migrations found.");
  process.exit(1);
}

const banner = `-- ===========================================================================
-- Publish Coffee Roasters -- complete database setup
-- PT Aroma Pulau Arunika
--
-- THIS FILE IS GENERATED. Do not edit it by hand.
-- Edit supabase/migrations/*.sql instead, then run: npm run build:sql
--
-- ---------------------------------------------------------------------------
-- HOW TO USE THIS
--
-- Setting up a brand new Supabase project:
--   Copy this entire file, paste it into Supabase -> SQL Editor, click Run.
--   That is the whole database. You should see "Success. No rows returned."
--
-- Already have the site running:
--   Do NOT use this file. Run only the new numbered files from
--   supabase/migrations/ that you have not run before.
--
-- Running this twice is safe: tables, functions and policies are replaced
-- rather than duplicated, the example content is skipped if it already exists,
-- and your own settings are never overwritten.
--
-- Generated from ${files.length} migrations:
${files.map((name) => `--   ${name}`).join("\n")}
-- ===========================================================================

`;

const body = files
  .map((name) => {
    const sql = readFileSync(join(MIGRATIONS_DIR, name), "utf8").trimEnd();
    return [
      "",
      "-- ###########################################################################",
      `-- ## ${name}`,
      "-- ###########################################################################",
      "",
      sql,
      "",
    ].join("\n");
  })
  .join("\n");

writeFileSync(OUTPUT, `${banner}${body}\n`);

console.log(`Wrote supabase/setup.sql from ${files.length} migrations:`);
for (const name of files) console.log(`  ${name}`);
