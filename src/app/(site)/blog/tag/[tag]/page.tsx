import type { Metadata } from "next";
import Link from "next/link";
import { PostCard } from "@/components/blog/post-card";
import { journalFontClassNames } from "@/lib/fonts";
import { EmptyState } from "@/components/empty-state";
import { getPublishedPosts } from "@/lib/queries";

/*
 * Revalidation is a backstop, not the update mechanism: every admin action
 * calls revalidatePath, so edits appear immediately. This timer only catches
 * changes made outside the admin and scheduled posts going live — so it is set
 * long, because each expiry costs a fresh set of database queries.
 */
export const revalidate = 1800;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tag: string }>;
}): Promise<Metadata> {
  const { tag } = await params;
  const decoded = decodeURIComponent(tag);

  return {
    title: `#${decoded} — The Journal`,
    description: `Posts tagged ${decoded} from the Publish Coffee Roasters journal.`,
    alternates: { canonical: `/blog/tag/${tag}` },
  };
}

export default async function BlogTagPage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag } = await params;
  const decoded = decodeURIComponent(tag);
  const posts = await getPublishedPosts({ tag: decoded });

  return (
    <div className={`journal ${journalFontClassNames} container-page py-10`}>
      <nav className="meta text-sea-800">
        <Link href="/blog" className="hover:text-ink">
          The Journal
        </Link>
        <span className="mx-2 text-sea-400">/</span>
        <span>Tagged</span>
      </nav>

      <div className="mt-6 flex items-baseline gap-4 border-b border-ink pb-4">
        <h1 className="text-4xl sm:text-5xl">{decoded}</h1>
        <span className="meta ml-auto text-sea-800">
          {posts.length} {posts.length === 1 ? "story" : "stories"}
        </span>
      </div>

      {posts.length ? (
        <div className="mt-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} size="compact" />
          ))}
        </div>
      ) : (
        <div className="mt-14">
          <EmptyState
            title="No posts with that tag"
            actionLabel="Back to the Journal"
            actionHref="/blog"
          />
        </div>
      )}
    </div>
  );
}
