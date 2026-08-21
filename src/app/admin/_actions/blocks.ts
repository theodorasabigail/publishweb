"use server";

import { revalidatePath } from "next/cache";
import { blockDefinition, type PageBlock } from "@/lib/blocks";
import { adminClient, boolean, describeDbError, integer, text } from "./guard";

/**
 * Blocks are stored as jsonb, so nothing about the shape of `content` is
 * enforced by the database. It is enforced here instead: only fields the block
 * type actually declares are written, so a stale form, a renamed field or a
 * hand-crafted request cannot put arbitrary keys into the row.
 */
function contentFor(type: string, formData: FormData): Record<string, string> {
  const definition = blockDefinition(type);
  if (!definition) throw new Error("Unknown block type.");

  const content: Record<string, string> = {};
  for (const field of definition.fields) {
    const value = text(formData, field.name);
    if (value) content[field.name] = value;
  }
  return content;
}

/** Revalidate wherever this page is actually served from. */
const BUILT_IN_ROUTES: Record<string, string> = {
  home: "/",
  shop: "/shop",
  roasting: "/roasting",
  blog: "/blog",
  about: "/about",
};

function revalidatePage(page: string) {
  revalidatePath(BUILT_IN_ROUTES[page] ?? `/p/${page}`);
  revalidatePath("/admin/pages");
  revalidatePath(`/admin/pages/${page}`);
}

export async function addBlock(formData: FormData) {
  const { supabase } = await adminClient();
  const page = text(formData, "page");
  const type = text(formData, "block_type");

  if (!page) throw new Error("Missing page.");
  if (!blockDefinition(type)) throw new Error("Unknown block type.");

  // New blocks go to the bottom, which is where someone adding one is looking.
  const { data: last } = await supabase
    .from("page_blocks")
    .select("sort_order")
    .eq("page", page)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("page_blocks").insert({
    page,
    block_type: type,
    sort_order: ((last as { sort_order: number } | null)?.sort_order ?? -1) + 1,
    // Added switched off. A half-filled block appearing on the live homepage
    // the instant it is created is the wrong default for a shop that is open.
    is_active: false,
    content: {},
  });

  if (error) throw new Error("Could not add that block.");
  revalidatePage(page);
}

export async function updateBlock(formData: FormData) {
  const { supabase } = await adminClient();
  const id = text(formData, "id");
  const page = text(formData, "page");
  const type = text(formData, "block_type");

  const { error } = await supabase
    .from("page_blocks")
    .update({
      content: contentFor(type, formData),
      is_active: boolean(formData, "is_active"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error("Could not save that block.");
  revalidatePage(page);
}

export async function deleteBlock(formData: FormData) {
  const { supabase } = await adminClient();
  const id = text(formData, "id");
  const page = text(formData, "page");

  await supabase.from("page_blocks").delete().eq("id", id);
  revalidatePage(page);
}

/** Swap a block with the one above or below it. */
export async function moveBlock(formData: FormData) {
  const { supabase } = await adminClient();
  const id = text(formData, "id");
  const page = text(formData, "page");
  const direction = integer(formData, "direction", 0);

  const { data } = await supabase
    .from("page_blocks")
    .select("*")
    .eq("page", page)
    .order("sort_order");

  const blocks = (data ?? []) as PageBlock[];
  const index = blocks.findIndex((block) => block.id === id);
  const target = index + (direction < 0 ? -1 : 1);
  if (index < 0 || target < 0 || target >= blocks.length) return;

  // Rewrite every position rather than swapping two, so duplicate or missing
  // sort_order values from any earlier state get repaired on the way past.
  const reordered = [...blocks];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

  await Promise.all(
    reordered.map((block, position) =>
      supabase.from("page_blocks").update({ sort_order: position }).eq("id", block.id),
    ),
  );

  revalidatePage(page);
}

// ---------------------------------------------------------------------------
// Custom pages
// ---------------------------------------------------------------------------

export async function createPage(formData: FormData) {
  const { supabase } = await adminClient();
  const { slugify } = await import("@/lib/utils");

  const title = text(formData, "title");
  if (!title) throw new Error("A page needs a name.");

  const slug = slugify(text(formData, "slug") || title);
  // These name routes that already exist. A custom page sharing one would make
  // two different things answer to the same name, and only one could win.
  if (slug in BUILT_IN_ROUTES) {
    throw new Error("That name is already used by a page of the site.");
  }

  const { error } = await supabase.from("pages").insert({ title, slug });
  if (error) {
    throw new Error(
      error.code === "23505" ? "A page with that address already exists." : "Could not create the page.",
    );
  }

  revalidatePath("/admin/pages");
}

export async function updatePage(formData: FormData) {
  const { supabase } = await adminClient();
  const slug = text(formData, "slug");
  const mode = text(formData, "blocks_mode") === "replace" ? "replace" : "append";

  const patch: Record<string, unknown> = {
    title: text(formData, "title"),
    seo_title: text(formData, "seo_title") || null,
    seo_description: text(formData, "seo_description") || null,
    show_in_nav: boolean(formData, "show_in_nav"),
    nav_order: integer(formData, "nav_order", 0),
    blocks_mode: mode,
    // Null rather than "" when cleared, so the page falls back to the wording
    // it ships with instead of rendering an empty heading.
    heading: text(formData, "heading") || null,
    intro: text(formData, "intro") || null,
    updated_at: new Date().toISOString(),
  };

  // A built-in page is a route in the code. Unpublishing one would leave the
  // route answering with nothing, so that switch is not offered for them and
  // is not accepted here either.
  if (!boolean(formData, "is_built_in")) {
    patch.is_published = boolean(formData, "is_published");
  }

  const { error } = await supabase.from("pages").update(patch).eq("slug", slug);
  if (error) {
    throw new Error(
      describeDbError(error, "Could not save that page."),
    );
  }

  revalidatePath("/", "layout");
  revalidatePage(slug);
}

export async function deletePage(formData: FormData) {
  const { supabase } = await adminClient();
  const slug = text(formData, "slug");

  // The five built-in pages are routes in the code. Deleting the row would not
  // remove the page, it would just strip its wording and its menu entry and
  // then reappear the next time the setup file runs.
  if (slug in BUILT_IN_ROUTES) {
    throw new Error("That page is part of the site and cannot be deleted.");
  }

  // Blocks are keyed by slug rather than by a foreign key, so they have to go
  // explicitly or they would linger invisibly and reappear if the slug were
  // ever reused.
  await supabase.from("page_blocks").delete().eq("page", slug);
  await supabase.from("pages").delete().eq("id", text(formData, "id"));

  revalidatePath("/", "layout");
  revalidatePath("/admin/pages");
}

/**
 * Turn a built-in page into the blocks that reproduce it.
 *
 * The alternative was adding an editable field to every component for every
 * sentence, forever — and every new sentence would need another field, another
 * column and another deploy. This inverts it: the page becomes blocks once,
 * and from then on every word is already editable because blocks are editable.
 *
 * The blocks are seeded with the wording currently on the page, so pressing
 * this changes nothing a visitor can see. It only changes who can edit it.
 *
 * Refuses if blocks already exist, because the honest failure here is silently
 * doubling a page someone had already started building.
 */
export async function convertPageToBlocks(formData: FormData) {
  const { supabase } = await adminClient();
  const slug = text(formData, "page");

  const starter = STARTER_BLOCKS[slug];
  if (!starter) throw new Error("That page cannot be rebuilt from blocks yet.");

  const { data: existing } = await supabase
    .from("page_blocks")
    .select("id")
    .eq("page", slug)
    .limit(1);

  if ((existing ?? []).length) {
    throw new Error(
      "This page already has blocks. Delete them first, or add what you need by hand.",
    );
  }

  const { error } = await supabase.from("page_blocks").insert(
    starter.map((block, index) => ({
      page: slug,
      block_type: block.type,
      sort_order: index,
      // Switched on: these reproduce what the page already shows, so leaving
      // them off would blank the page the moment replace mode is set.
      is_active: true,
      content: block.content,
    })),
  );
  if (error) throw new Error(describeDbError(error, "Could not rebuild that page."));

  await supabase
    .from("pages")
    .update({ blocks_mode: "replace", updated_at: new Date().toISOString() })
    .eq("slug", slug);

  revalidatePath("/", "layout");
  revalidatePage(slug);
}

/**
 * What each built-in page becomes.
 *
 * Deliberately the same words the page ships with, so the conversion is
 * invisible from the outside and the operator edits from where they already
 * are rather than from a blank page.
 */
const STARTER_BLOCKS: Record<
  string,
  { type: string; content: Record<string, string> }[]
> = {
  home: [
    {
      type: "features",
      content: {
        icon1: "flame",
        title1: "Roasted to order",
        body1: "Bags go out within 48 hours of coming off the drum.",
        icon2: "package",
        title2: "Three sizes",
        body2: "100g to try, 200g for the week, 1kg for the caf\u00e9.",
        icon3: "globe",
        title3: "Ships worldwide",
        body3: "Flat-rate international zones, no surprise fees at checkout.",
      },
    },
    {
      type: "products",
      content: {
        heading: "On the shelf",
        categoryId: "featured",
        limit: "4",
        ctaLabel: "See everything",
        ctaHref: "/shop",
      },
    },
    {
      type: "categories",
      content: { heading: "Browse by style", linkLabel: "Browse" },
    },
    {
      type: "split",
      content: {
        side: "right",
        tone: "dark",
        eyebrow: "Jasa Roasting",
        heading: "Bring us your green beans.",
        body: "We roast to order for caf\u00e9s, small brands, and anyone with a sack of green coffee and nowhere to roast it.",
        ctaLabel: "Ask for a quote",
        ctaHref: "/roasting",
      },
    },
    {
      type: "posts",
      content: {
        heading: "From the Journal",
        limit: "3",
        ctaLabel: "All writing",
        ctaHref: "/blog",
      },
    },
  ],
};
