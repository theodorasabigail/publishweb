import type { Metadata } from "next";
import Link from "next/link";
import { PostCard } from "@/components/blog/post-card";
import { EmptyState } from "@/components/empty-state";
import {
  getAllTags,
  getBlogCategories,
  getPublishedPosts,
  getSiteSettings,
} from "@/lib/queries";

/*
 * Revalidation is a backstop, not the update mechanism: every admin action
 * calls revalidatePath, so edits appear immediately. This timer only catches
 * changes made outside the admin and scheduled posts going live — so it is set
 * long, because each expiry costs a fresh set of database queries.
 */
export const revalidate = 1800;

export const metadata: Metadata = {
  title: "The Journal",
  description:
    "Roasting notes, origin trips, brewing arguments, and everything else that happens in a small Indonesian roastery.",
  alternates: {
    canonical: "/blog",
    types: { "application/rss+xml": "/rss.xml" },
  },
};

export default async function BlogIndexPage() {
  const [posts, categories, tags, settings] = await Promise.all([
    getPublishedPosts(),
    getBlogCategories(),
    getAllTags(),
    getSiteSettings(),
  ]);

  // The operator pins one post from the admin; otherwise the newest leads.
  const pinned =
    posts.find((post) => post.id === settings.featured_post_id) ??
    posts.find((post) => post.is_featured) ??
    posts[0];

  const rest = posts.filter((post) => post.id !== pinned?.id);

  return (
    <div className="container-page py-14">
      <header className="max-w-2xl">
        <h1 className="text-5xl sm:text-6xl">The Journal</h1>
        <p className="mt-4 text-lg text-sea-800">
          What we are roasting, where it came from, and what we got wrong last
          week. Written by the people at the drum.
        </p>
      </header>

      {categories.length > 0 && (
        <nav className="mt-8 flex flex-wrap gap-2" aria-label="Post categories">
          <span className="badge bg-sea-800 text-cream">All</span>
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/blog/category/${category.slug}`}
              className="badge border border-sea-200 bg-white text-sea-700 hover:border-sea-400"
            >
              {category.name}
            </Link>
          ))}
          <a
            href="/rss.xml"
            className="badge border border-sea-200 bg-white text-sea-800 hover:border-sea-400"
          >
            RSS
          </a>
        </nav>
      )}

      {!posts.length ? (
        <div className="mt-12">
          <EmptyState
            title="Nothing published yet"
            description="Posts written in the admin dashboard appear here once published."
          />
        </div>
      ) : (
        <>
          {pinned && (
            <div className="mt-12 border-b border-sea-200/70 pb-12">
              <PostCard post={pinned} size="large" />
            </div>
          )}

          {rest.length > 0 && (
            <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </>
      )}

      {tags.length > 0 && (
        <section className="mt-16 border-t border-sea-200/70 pt-10">
          <h2 className="text-sm font-medium uppercase tracking-wider text-sea-800">
            Browse by tag
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Link
                key={tag}
                href={`/blog/tag/${encodeURIComponent(tag)}`}
                className="badge border border-sea-200 bg-white text-sea-800 hover:border-sea-400"
              >
                #{tag}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
