import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/admin/ui";
import { PostForm } from "@/components/admin/post-form";
import { deletePost } from "@/app/admin/_actions/blog";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BlogCategory, BlogPost } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const { saved } = await searchParams;

  const supabase = createAdminClient();
  const [{ data: post }, { data: categories }] = await Promise.all([
    supabase.from("blog_posts").select("*").eq("id", id).maybeSingle(),
    supabase.from("blog_categories").select("*").order("sort_order"),
  ]);

  if (!post) notFound();
  const typed = post as BlogPost;

  return (
    <div>
      <PageHeader
        title={typed.title}
        description={
          typed.status === "published"
            ? "Live on the Journal."
            : typed.status === "scheduled"
              ? "Scheduled — it will publish itself."
              : "Draft — not visible to anyone but you."
        }
        action={
          typed.status === "published" ? (
            <Link
              href={`/blog/${typed.slug}`}
              target="_blank"
              className="btn-secondary py-2 text-xs"
            >
              <ExternalLink className="h-3.5 w-3.5" /> View
            </Link>
          ) : undefined
        }
      />

      {saved && (
        <p className="mb-5 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Saved.
        </p>
      )}

      <PostForm post={typed} categories={(categories ?? []) as BlogCategory[]} />

      <form action={deletePost} className="mt-10 border-t border-bark-200 pt-6">
        <input type="hidden" name="id" value={typed.id} />
        <button
          type="submit"
          className="flex items-center gap-1.5 text-sm text-bark-600 hover:text-red-700"
        >
          <Trash2 className="h-4 w-4" /> Delete this post
        </button>
      </form>
    </div>
  );
}
