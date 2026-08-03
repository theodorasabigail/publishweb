import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostCard } from "@/components/blog/post-card";
import { EmptyState } from "@/components/empty-state";
import { getBlogCategories, getBlogCategoryBySlug, getPublishedPosts } from "@/lib/queries";

export const revalidate = 300;

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
    <div className="container-page py-14">
      <nav className="text-sm text-bark-500">
        <Link href="/blog" className="hover:underline">
          Journal
        </Link>
        <span className="mx-2">/</span>
        <span className="text-bark-800">{category.name}</span>
      </nav>

      <header className="mt-4 max-w-2xl">
        <span
          className="inline-block h-1.5 w-12 rounded-full"
          style={{ backgroundColor: category.accent_color }}
        />
        <h1 className="mt-4 text-4xl sm:text-5xl">{category.name}</h1>
        {category.description && (
          <p className="mt-4 text-lg text-bark-600">{category.description}</p>
        )}
      </header>

      <nav className="mt-8 flex flex-wrap gap-2" aria-label="Post categories">
        <Link
          href="/blog"
          className="badge border border-bark-200 bg-white text-bark-700 hover:border-bark-400"
        >
          All
        </Link>
        {categories.map((item) => (
          <Link
            key={item.id}
            href={`/blog/category/${item.slug}`}
            className={
              item.id === category.id
                ? "badge bg-bark-800 text-cream"
                : "badge border border-bark-200 bg-white text-bark-700 hover:border-bark-400"
            }
          >
            {item.name}
          </Link>
        ))}
      </nav>

      {posts.length ? (
        <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <div className="mt-12">
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
