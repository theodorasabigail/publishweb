"use server";

import { revalidatePath } from "next/cache";
import { slugify } from "@/lib/utils";
import { adminClient, boolean, integer, optionalText, text } from "./guard";

export async function saveCategory(formData: FormData) {
  const { supabase } = await adminClient();
  const id = text(formData, "id");
  const name = text(formData, "name");
  if (!name) throw new Error("A category needs a name.");

  const fields = {
    name,
    slug: slugify(text(formData, "slug") || name),
    description: optionalText(formData, "description"),
    image_url: optionalText(formData, "image_url"),
    show_on_homepage: boolean(formData, "show_on_homepage"),
    sort_order: integer(formData, "sort_order"),
    seo_title: optionalText(formData, "seo_title"),
    seo_description: optionalText(formData, "seo_description"),
  };

  const { error } = id
    ? await supabase.from("categories").update(fields).eq("id", id)
    : await supabase.from("categories").insert(fields);

  if (error) {
    throw new Error(
      error.code === "23505"
        ? "Another category is already using that URL slug."
        : "Could not save the category.",
    );
  }

  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/admin/categories");
}

export async function deleteCategory(formData: FormData) {
  const { supabase } = await adminClient();
  const id = text(formData, "id");

  // Products in this category are kept and simply become uncategorised.
  await supabase.from("categories").delete().eq("id", id);

  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/admin/categories");
}

export async function saveBlogCategory(formData: FormData) {
  const { supabase } = await adminClient();
  const id = text(formData, "id");
  const name = text(formData, "name");
  if (!name) throw new Error("A category needs a name.");

  const fields = {
    name,
    slug: slugify(text(formData, "slug") || name),
    description: optionalText(formData, "description"),
    accent_color: text(formData, "accent_color") || "#486b73",
    sort_order: integer(formData, "sort_order"),
  };

  const { error } = id
    ? await supabase.from("blog_categories").update(fields).eq("id", id)
    : await supabase.from("blog_categories").insert(fields);

  if (error) {
    throw new Error(
      error.code === "23505"
        ? "Another category is already using that URL slug."
        : "Could not save the category.",
    );
  }

  revalidatePath("/blog");
  revalidatePath("/blog/categories");
  revalidatePath("/admin/blog/categories");
}

export async function deleteBlogCategory(formData: FormData) {
  const { supabase } = await adminClient();
  await supabase.from("blog_categories").delete().eq("id", text(formData, "id"));

  revalidatePath("/blog");
  revalidatePath("/admin/blog/categories");
}
