import type { Metadata } from "next";
import Link from "next/link";
import { getBlogCategories, getPublishedPosts } from "@/lib/queries";

/*
 * Revalidation is a backstop, not the update mechanism: every admin action
 * calls revalidatePath, so edits appear immediately. This timer only catches
 * changes made outside the admin and scheduled posts going live — so it is set
 * long, because each expiry costs a fresh set of database queries.
 */
export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Journal categories",
  description: "Every section of the Publish Coffee Roasters journal.",
  alternates: { canonical: "/blog/categories" },
};

export default async function BlogCategoriesPage() {
  const [categories, posts] = await Promise.all([
    getBlogCategories(),
    getPublishedPosts(),
  ]);

  return (
    <div className="container-page py-14">
      <nav className="text-sm text-bark-500">
        <Link href="/blog" className="hover:underline">
          Journal
        </Link>
        <span className="mx-2">/</span>
        <span className="text-bark-800">Categories</span>
      </nav>

      <h1 className="mt-4 text-4xl sm:text-5xl">Categories</h1>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {categories.map((category) => {
          const count = posts.filter(
            (post) => post.blog_category_id === category.id,
          ).length;

          return (
            <Link
              key={category.id}
              href={`/blog/category/${category.slug}`}
              className="card group p-6 transition-colors hover:border-bark-400"
            >
              <span
                className="inline-block h-1.5 w-10 rounded-full"
                style={{ backgroundColor: category.accent_color }}
              />
              <p className="mt-3 font-serif text-2xl">{category.name}</p>
              {category.description && (
                <p className="mt-2 text-sm text-bark-600">{category.description}</p>
              )}
              <p className="mt-4 text-xs text-bark-500">
                {count} {count === 1 ? "post" : "posts"}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
