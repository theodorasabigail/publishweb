# Migrations

These numbered files are the source of truth for the database schema. Each one
is applied once, in order.

**For setting up a new Supabase project, do not use these.** Use
`../setup.sql` — a single generated file containing all of them, which is what
`docs/OPERATOR_SETUP.md` tells the operator to paste.

## Adding a migration

1. Add the next numbered file here (`0006_whatever.sql`).
2. Run `npm run build:sql` to regenerate `../setup.sql`.
3. Commit both.

`setup.sql` is generated, never edited by hand. Regenerating it is what keeps a
one-paste install identical to a step-by-step one.

## Applying a migration to a site that is already running

Run only the new numbered files, in order, in the Supabase SQL editor. Do not
re-run `setup.sql` expecting it to upgrade anything — it is safe to run, but it
is written for a fresh project.
