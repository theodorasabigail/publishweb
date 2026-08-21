import type { Metadata } from "next";
import Link from "next/link";
import { JournalMasthead } from "@/components/blog/journal-masthead";
import { PageBlocks } from "@/components/blocks/page-blocks";
import { blocksReplacePage, pageCopy } from "@/lib/blocks";
import { journalFontClassNames } from "@/lib/fonts";
import { PostCard } from "@/components/blog/post-card";
import { EmptyState } from "@/components/empty-state";
import {
  getAllTags,
  getBlogCategories,
  getPageContext,
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
  const [posts, categories, tags, settings, { page, blocks }] = await Promise.all([
    getPublishedPosts(),
    getBlogCategories(),
    getAllTags(),
    getSiteSettings(),
    getPageContext("blog"),
  ]);

  if (blocksReplacePage(page, blocks.length)) {
    return <PageBlocks blocks={blocks} />;
  }

  const copy = pageCopy("blog", page);

  // The operator pins one post from the admin; otherwise the newest leads.
  const lead =
    posts.find((post) => post.id === settings.featured_post_id) ??
    posts.find((post) => post.is_featured) ??
    posts[0];

  const rest = posts.filter((post) => post.id !== lead?.id);

  // A front page runs a lead, a short run of stories with pictures, and then
  // an index of everything else. Four is what fits two rows of two without
  // leaving a gap.
  const secondary = rest.slice(0, 4);
  const archive = rest.slice(4);

  return (
    <div className={`journal ${journalFontClassNames} container-page py-10`}>
      <JournalMasthead
        categories={categories}
        active="all"
        title={copy.heading}
        tagline={copy.intro}
      />

      {!posts.length ? (
        <div className="mt-16">
          <EmptyState
            title="Nothing published yet"
            description="Posts written in the admin dashboard appear here once published."
          />
        </div>
      ) : (
        <>
          {lead && (
            <div className="mt-12">
              <PostCard post={lead} size="lead" priority />
            </div>
          )}

          {secondary.length > 0 && (
            <div className="mt-16 grid gap-x-10 gap-y-14 border-t border-sea-200 pt-14 sm:grid-cols-2">
              {secondary.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}

          {archive.length > 0 && (
            <section className="mt-20">
              <h2 className="kicker border-b border-ink pb-3 text-ink">
                More from the journal
              </h2>
              <div className="mt-0">
                {archive.map((post) => (
                  <PostCard key={post.id} post={post} size="compact" />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <PageBlocks blocks={blocks} />

      {tags.length > 0 && (
        <section className="mt-20 border-t border-sea-200 pt-8">
          <h2 className="kicker text-sea-800">Browse by tag</h2>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            {tags.map((tag) => (
              <Link
                key={tag}
                href={`/blog/tag/${encodeURIComponent(tag)}`}
                className="meta text-sea-800 underline decoration-sea-300 underline-offset-4 hover:text-ink hover:decoration-ink"
              >
                {tag}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
