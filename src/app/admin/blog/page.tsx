import Link from "next/link";
import { Plus, Tags } from "lucide-react";
import { EmptyRow, PageHeader } from "@/components/admin/ui";
import { setFeaturedPost } from "@/app/admin/_actions/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BlogPostWithCategory, SiteSettings } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-sea-100 text-sea-700",
  scheduled: "bg-sky-100 text-sky-800",
  published: "bg-emerald-100 text-emerald-800",
};

export default async function AdminBlogPage() {
  const supabase = createAdminClient();

  const [{ data: posts }, { data: settings }] = await Promise.all([
    supabase
      .from("blog_posts")
      .select("*, blog_categories ( id, slug, name, accent_color )")
      .order("published_at", { ascending: false, nullsFirst: true })
      .order("created_at", { ascending: false }),
    supabase.from("site_settings").select("*").eq("id", true).maybeSingle(),
  ]);

  const rows = (posts ?? []) as BlogPostWithCategory[];
  const featuredId = (settings as SiteSettings | null)?.featured_post_id ?? "";

  return (
    <div>
      <PageHeader
        title="Journal"
        description="Write, schedule and publish. Nothing goes live until you say so."
        action={
          <div className="flex gap-2">
            <Link href="/admin/blog/categories" className="btn-secondary">
              <Tags className="h-4 w-4" /> Categories
            </Link>
            <Link href="/admin/blog/new" className="btn-primary">
              <Plus className="h-4 w-4" /> New post
            </Link>
          </div>
        }
      />

      <form
        action={setFeaturedPost}
        className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-sea-200 bg-white p-4"
      >
        <div className="min-w-64 flex-1">
          <label className="label" htmlFor="post_id">
            Pinned at the top of the archive
          </label>
          <select id="post_id" name="post_id" className="input" defaultValue={featuredId}>
            <option value="">Newest post (automatic)</option>
            {rows
              .filter((post) => post.status === "published")
              .map((post) => (
                <option key={post.id} value={post.id}>
                  {post.title}
                </option>
              ))}
          </select>
        </div>
        <button type="submit" className="btn-secondary py-2 text-xs">
          Pin it
        </button>
      </form>

      {rows.length ? (
        <div className="overflow-x-auto rounded-xl border border-sea-200 bg-white">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="border-b border-sea-200 text-left text-xs uppercase tracking-wider text-sea-800">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Publish date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sea-200">
              {rows.map((post) => (
                <tr key={post.id} className="hover:bg-sea-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/blog/${post.id}`}
                      className="font-medium hover:underline"
                    >
                      {post.title}
                    </Link>
                    {post.id === featuredId && (
                      <span className="ml-2 badge bg-amber-100 text-amber-800">Pinned</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sea-800">
                    {post.blog_categories?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("badge capitalize", STATUS_STYLES[post.status])}>
                      {post.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sea-800">
                    {post.published_at ? formatDateTime(post.published_at) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyRow>
          Nothing written yet.{" "}
          <Link href="/admin/blog/new" className="underline">
            Start the first post
          </Link>
          .
        </EmptyRow>
      )}
    </div>
  );
}
