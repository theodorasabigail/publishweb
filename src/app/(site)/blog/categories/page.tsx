import type { Metadata } from "next";
import Link from "next/link";
import { journalFontClassNames } from "@/lib/fonts";
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
    <div className={`journal ${journalFontClassNames} container-page py-10`}>
      <nav className="meta text-sea-800">
        <Link href="/blog" className="hover:text-ink">
          The Journal
        </Link>
        <span className="mx-2 text-sea-400">/</span>
        <span>Sections</span>
      </nav>

      <h1 className="mt-6 border-b border-ink pb-4 text-4xl sm:text-5xl">
        Sections
      </h1>

      {/* A contents page: rules between entries, not boxes around them. */}
      <div className="mt-2">
        {categories.map((category) => {
          const count = posts.filter(
            (post) => post.blog_category_id === category.id,
          ).length;

          return (
            <Link
              key={category.id}
              href={`/blog/category/${category.slug}`}
              className="group flex items-baseline gap-4 border-b border-sea-200 py-6"
            >
              <span
                className="mt-2 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: category.accent_color }}
              />
              <div className="min-w-0 flex-1">
                <h2 className="text-2xl group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">
                  {category.name}
                </h2>
                {category.description && (
                  <p className="mt-1.5 text-sea-800">{category.description}</p>
                )}
              </div>
              <span className="meta shrink-0 text-sea-800">
                {count} {count === 1 ? "story" : "stories"}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
