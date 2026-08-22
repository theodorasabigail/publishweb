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

## Re-runnability and function shapes

`create or replace function` cannot change a function's **return type**. So when
a later migration changes what a function returns, the earlier migration that
created it has to stop conflicting with the newer shape — otherwise the second
paste of `setup.sql` fails partway through, on a file that has not changed.

Two of these exist, both caused by `0019` widening `channel` from an enum to
text:

- `sales_summary` — `0005` now declares `channel` as text and casts on the way
  out, which is correct whichever type the column is.
- `product_sales_report` — `0019` gives it an extra column, so `0005` drops it
  before creating it.

If you change what an existing function returns, check that `setup.sql` still
applies twice in a row against a database that has already had it once.
