"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PostStatus } from "@/lib/types";
import { readingMinutes, slugify, truncate } from "@/lib/utils";
import { markdownToPlainText } from "@/lib/markdown";
import { adminClient, boolean, optionalText, text } from "./guard";

function revalidateBlog(slug?: string | null) {
  revalidatePath("/");
  revalidatePath("/blog");
  revalidatePath("/blog/categories");
  revalidatePath("/rss.xml");
  revalidatePath("/admin/blog");
  if (slug) revalidatePath(`/blog/${slug}`);
}

function postFields(formData: FormData) {
  const title = text(formData, "title");
  const body = optionalText(formData, "body");
  const status = (text(formData, "status") || "draft") as PostStatus;
  const scheduledFor = optionalText(formData, "published_at");

  // A post is only ever live once published_at has passed, so publishing now
  // and scheduling for later are the same code path with a different date.
  let publishedAt: string | null = null;
  if (status === "published") {
    publishedAt = scheduledFor ? new Date(scheduledFor).toISOString() : new Date().toISOString();
  } else if (status === "scheduled" && scheduledFor) {
    publishedAt = new Date(scheduledFor).toISOString();
  }

  return {
    title,
    slug: slugify(text(formData, "slug") || title),
    excerpt:
      optionalText(formData, "excerpt") ??
      (body ? truncate(markdownToPlainText(body), 180) : null),
    body,
    cover_image: optionalText(formData, "cover_image"),
    cover_alt: optionalText(formData, "cover_alt"),
    author_name: text(formData, "author_name") || "Publish Coffee Roasters",
    blog_category_id: optionalText(formData, "blog_category_id"),
    tags: text(formData, "tags")
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean),
    status,
    is_featured: boolean(formData, "is_featured"),
    reading_minutes: readingMinutes(body),
    seo_title: optionalText(formData, "seo_title"),
    seo_description: optionalText(formData, "seo_description"),
    og_image_url: optionalText(formData, "og_image_url"),
    published_at: publishedAt,
  };
}

export async function createPost(formData: FormData) {
  const { supabase } = await adminClient();
  const fields = postFields(formData);
  if (!fields.title) throw new Error("A post needs a title.");

  const { data, error } = await supabase
    .from("blog_posts")
    .insert(fields)
    .select("id, slug")
    .single();

  if (error) {
    throw new Error(
      error.code === "23505"
        ? "Another post is already using that URL slug."
        : "Could not save the post.",
    );
  }

  revalidateBlog(data.slug);
  redirect(`/admin/blog/${data.id}?saved=1`);
}

export async function updatePost(formData: FormData) {
  const { supabase } = await adminClient();
  const id = text(formData, "id");
  if (!id) throw new Error("Missing post id.");

  const fields = postFields(formData);
  const { error } = await supabase.from("blog_posts").update(fields).eq("id", id);

  if (error) {
    throw new Error(
      error.code === "23505"
        ? "Another post is already using that URL slug."
        : "Could not save the post.",
    );
  }

  revalidateBlog(fields.slug);
  redirect(`/admin/blog/${id}?saved=1`);
}

export async function deletePost(formData: FormData) {
  const { supabase } = await adminClient();
  await supabase.from("blog_posts").delete().eq("id", text(formData, "id"));
  revalidateBlog();
  redirect("/admin/blog");
}
