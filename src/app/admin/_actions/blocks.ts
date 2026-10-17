"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminClient, text } from "./guard";

/**
 * Adding and deleting whole pages. Everything on a page -- its sections, its
 * wording, its menu entry -- is edited through page-editor.ts.
 */

/** The built-in pages, which answer at their own routes and cannot be removed. */
const BUILT_IN_ROUTES: Record<string, string> = {
  home: "/",
  shop: "/shop",
  roasting: "/roasting",
  blog: "/blog",
  about: "/about",
};

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
  // Straight into the new page, ready for its first section.
  redirect(`/admin/pages/${slug}`);
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
  redirect("/admin/pages");
}
