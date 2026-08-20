import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JournalMasthead } from "@/components/blog/journal-masthead";
import { PostCard } from "@/components/blog/post-card";
import { journalFontClassNames } from "@/lib/fonts";
import { EmptyState } from "@/components/empty-state";
import { getBlogCategories, getBlogCategoryBySlug, getPublishedPosts } from "@/lib/queries";

/*
 * Revalidation is a backstop, not the update mechanism: every admin action
 * calls revalidatePath, so edits appear immediately. This timer only catches
 * changes made outside the admin and scheduled posts going live — so it is set
 * long, because each expiry costs a fresh set of database queries.
 */
export const revalidate = 1800;

export async function generateStaticParams() {
  const categories = await getBlogCategories();
  return categories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await getBlogCategoryBySlug(slug);
  if (!category) return { title: "Category not found" };

  return {
    title: `${category.name} — The Journal`,
    description: category.description ?? undefined,
    alternates: { canonical: `/blog/category/${category.slug}` },
  };
}

export default async function BlogCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = await getBlogCategoryBySlug(slug);
  if (!category) notFound();

  const [posts, categories] = await Promise.all([
    getPublishedPosts({ categoryId: category.id }),
    getBlogCategories(),
  ]);

  return (
    <div className={`journal ${journalFontClassNames} container-page py-10`}>
      <JournalMasthead
        categories={categories}
        active={category.slug}
        tagline={category.description ?? undefined}
      />

      <div className="mt-10 flex items-baseline gap-3 border-b border-sea-200 pb-4">
        <span
          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: category.accent_color }}
        />
        <h2 className="text-3xl sm:text-4xl">{category.name}</h2>
        <span className="meta ml-auto text-sea-800">
          {posts.length} {posts.length === 1 ? "story" : "stories"}
        </span>
      </div>

      {posts.length ? (
        <>
          <div className="mt-12">
            <PostCard post={posts[0]} size="lead" priority />
          </div>
          {posts.length > 1 && (
            <div className="mt-16 grid gap-x-10 gap-y-14 border-t border-sea-200 pt-14 sm:grid-cols-2">
              {posts.slice(1).map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="mt-14">
          <EmptyState
            title={`Nothing in ${category.name} yet`}
            actionLabel="Back to the Journal"
            actionHref="/blog"
          />
        </div>
      )}
    </div>
  );
}
