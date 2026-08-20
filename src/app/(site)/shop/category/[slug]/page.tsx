import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { ProductCard } from "@/components/shop/product-card";
import { getCategories, getCategoryBySlug, getProducts } from "@/lib/queries";

/*
 * Revalidation is a backstop, not the update mechanism: every admin action
 * calls revalidatePath, so edits appear immediately. This timer only catches
 * changes made outside the admin and scheduled posts going live — so it is set
 * long, because each expiry costs a fresh set of database queries.
 */
export const revalidate = 1800;

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: "Category not found" };

  return {
    title: category.seo_title ?? category.name,
    description: category.seo_description ?? category.description ?? undefined,
    alternates: { canonical: `/shop/category/${category.slug}` },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const [products, categories] = await Promise.all([
    getProducts({ categoryId: category.id }),
    getCategories(),
  ]);

  return (
    <div className="container-page py-14">
      <nav className="text-sm text-sea-800">
        <Link href="/shop" className="hover:underline">
          Shop
        </Link>
        <span className="mx-2">/</span>
        <span className="text-sea-800">{category.name}</span>
      </nav>

      <header className="mt-4 max-w-2xl">
        <h1 className="text-4xl sm:text-5xl">{category.name}</h1>
        {category.description && (
          <p className="mt-4 text-sea-800">{category.description}</p>
        )}
      </header>

      <nav className="mt-8 flex flex-wrap gap-2" aria-label="Product categories">
        <Link
          href="/shop"
          className="badge border border-sea-200 bg-white text-sea-700 hover:border-sea-400"
        >
          All
        </Link>
        {categories.map((item) => (
          <Link
            key={item.id}
            href={`/shop/category/${item.slug}`}
            className={
              item.id === category.id
                ? "badge bg-sea-800 text-cream"
                : "badge border border-sea-200 bg-white text-sea-700 hover:border-sea-400"
            }
          >
            {item.name}
          </Link>
        ))}
      </nav>

      {products.length ? (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="mt-10">
          <EmptyState
            title={`Nothing in ${category.name} right now`}
            description="Try the full roast list — something else may be close to what you are after."
            actionLabel="See all coffee"
            actionHref="/shop"
          />
        </div>
      )}
    </div>
  );
}
