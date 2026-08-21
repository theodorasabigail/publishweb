# supabase/

Two files get pasted into Supabase. Everything else here builds them.

| File | When | What it does |
|---|---|---|
| `setup.sql` | Whenever the admin says the database needs updating. As often as you like. | Adds structure that is missing. Contains no coffees, prices, categories or writing. |
| `starter-content.sql` | **Once**, on a brand-new project, after `setup.sql`. | Adds the starting coffees, shipping rates, categories and sample posts. |

## Why they are separate

`setup.sql` is pasted again every time the site gains a feature, so the
question that matters is not "is it careful with my content" but "can it touch
my content at all". Splitting content out makes the answer no — there is
nothing in the file that could.

`starter-content.sql` is the opposite and says so at the top. Its statements
skip rows that already exist, so re-running will not overwrite a price you
changed — but it *would* bring back a coffee you deliberately deleted, because
from its point of view a missing row is one it has not added yet.

## Editing

- Structure → `migrations/*.sql`, numbered, each one additive and re-runnable.
- Starting content → `content/*.sql`.

Then `npm run build:sql`, which regenerates both pasted files.

## The one thing setup.sql removes

`0003_housekeeping.sql` deletes six placeholder coffees left by earlier
versions of this project, by name. The slugs are written out in full; they
cannot match a real product. Order history is unaffected — order lines carry
their own name, size and price snapshots.
