import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { ProductCard } from "@/components/shop/product-card";
import { getCategories, getProducts } from "@/lib/queries";

/*
 * Revalidation is a backstop, not the update mechanism: every admin action
 * calls revalidatePath, so edits appear immediately. This timer only catches
 * changes made outside the admin and scheduled posts going live — so it is set
 * long, because each expiry costs a fresh set of database queries.
 */
export const revalidate = 1800;

export const metadata: Metadata = {
  title: "Shop",
  description:
    "Every coffee we are roasting right now — single origins, blends, filter and espresso roasts, in 100g, 200g and 1kg.",
  alternates: { canonical: "/shop" },
};

export default async function ShopPage() {
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);

  return (
    <div className="container-page py-14">
      <header className="max-w-2xl">
        <h1 className="text-4xl sm:text-5xl">The roast list</h1>
        <p className="mt-4 text-bark-600">
          Everything currently on the shelf. Bags are roasted to order and shipped
          within 48 hours.
        </p>
      </header>

      {categories.length > 0 && (
        <nav className="mt-8 flex flex-wrap gap-2" aria-label="Product categories">
          <span className="badge bg-bark-800 text-cream">All</span>
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/shop/category/${category.slug}`}
              className="badge border border-bark-200 bg-white text-bark-700 hover:border-bark-400"
            >
              {category.name}
            </Link>
          ))}
        </nav>
      )}

      {products.length ? (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="mt-10">
          <EmptyState
            title="Nothing listed yet"
            description="Products added in the admin dashboard show up here straight away."
          />
        </div>
      )}
    </div>
  );
}
