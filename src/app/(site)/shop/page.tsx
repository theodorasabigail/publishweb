import type { Metadata } from "next";
import { ShopBrowser } from "@/components/shop/shop-browser";
import { getCategories, getProducts } from "@/lib/queries";

/*
 * Revalidation is a backstop, not the update mechanism: every admin action
 * calls revalidatePath, so edits appear immediately. This timer only catches
 * changes made outside the admin and scheduled posts going live — so it is set
 * long, because each expiry costs a fresh set of database queries.
 *
 * Filtering is deliberately not in the URL. Doing it with search params would
 * make this page render per request and cost a query per checkbox; the whole
 * list is sent once instead and filtered in the browser, which keeps the page
 * cached and makes filtering instant.
 */
export const revalidate = 1800;

export const metadata: Metadata = {
  title: "Shop",
  description:
    "Every coffee we are roasting right now — filter and search by origin, process and price.",
  alternates: { canonical: "/shop" },
};

export default async function ShopPage() {
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);

  return (
    <div className="container-page py-14">
      <header className="max-w-2xl">
        <h1 className="text-4xl sm:text-5xl">The roast list</h1>
        <p className="mt-4 text-sea-800">
          Every coffee on the shelf right now, whatever it is grouped under.
          Roasted to order and shipped within 48 hours.
        </p>
      </header>

      <ShopBrowser products={products} categories={categories} />
    </div>
  );
}
