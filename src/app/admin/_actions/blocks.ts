"use server";

import { revalidatePath } from "next/cache";
import { blockDefinition, type PageBlock } from "@/lib/blocks";
import { adminClient, boolean, integer, text } from "./guard";

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
function revalidatePage(page: string) {
  if (page === "home") revalidatePath("/");
  else if (page === "about") revalidatePath("/about");
  else revalidatePath(`/p/${page}`);
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
  // These are page identifiers, not slugs of a custom page; letting one be
  // created would make two different things answer to the same name.
  if (["home", "about"].includes(slug)) {
    throw new Error("That name is already used by a built-in page.");
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
  const id = text(formData, "id");
  const slug = text(formData, "slug");

  await supabase
    .from("pages")
    .update({
      title: text(formData, "title"),
      seo_title: text(formData, "seo_title") || null,
      seo_description: text(formData, "seo_description") || null,
      is_published: boolean(formData, "is_published"),
      show_in_nav: boolean(formData, "show_in_nav"),
      nav_order: integer(formData, "nav_order", 0),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  revalidatePath("/", "layout");
  revalidatePath(`/p/${slug}`);
}

export async function deletePage(formData: FormData) {
  const { supabase } = await adminClient();
  const slug = text(formData, "slug");

  // Blocks are keyed by slug rather than by a foreign key, so they have to go
  // explicitly or they would linger invisibly and reappear if the slug were
  // ever reused.
  await supabase.from("page_blocks").delete().eq("page", slug);
  await supabase.from("pages").delete().eq("id", text(formData, "id"));

  revalidatePath("/", "layout");
  revalidatePath("/admin/pages");
}
