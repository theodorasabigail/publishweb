import type { Metadata } from "next";
import Link from "next/link";
import { PostCard } from "@/components/blog/post-card";
import { EmptyState } from "@/components/empty-state";
import { getPublishedPosts } from "@/lib/queries";

export const revalidate = 300;

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
    <div className="container-page py-14">
      <nav className="text-sm text-bark-500">
        <Link href="/blog" className="hover:underline">
          Journal
        </Link>
        <span className="mx-2">/</span>
        <span className="text-bark-800">#{decoded}</span>
      </nav>

      <h1 className="mt-4 text-4xl sm:text-5xl">#{decoded}</h1>

      {posts.length ? (
        <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <div className="mt-12">
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
