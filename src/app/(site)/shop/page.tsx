import type { Metadata } from "next";
import { ShopBrowser } from "@/components/shop/shop-browser";
import { PageBlocks } from "@/components/blocks/page-blocks";
import { blocksReplacePage, pageCopy } from "@/lib/blocks";
import { getCategories, getPageContext, getProducts } from "@/lib/queries";

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
  const [products, categories, { page, blocks }] = await Promise.all([
    getProducts(),
    getCategories(),
    getPageContext("shop"),
  ]);

  // The operator can hand the whole page over to their blocks. Only takes
  // effect when there are blocks, so "replace" can never render nothing.
  if (blocksReplacePage(page, blocks.length)) {
    return <PageBlocks blocks={blocks} />;
  }

  const copy = pageCopy("shop", page);

  return (
    <div className="container-page py-14">
      <header className="max-w-4xl">
        <h1 className="text-6xl uppercase sm:text-8xl">{copy.heading}</h1>
        {copy.intro && (
          <p className="mt-6 max-w-md whitespace-pre-line text-sea-800">
            {copy.intro}
          </p>
        )}
      </header>

      <ShopBrowser products={products} categories={categories} />

      <PageBlocks blocks={blocks} />
    </div>
  );
}
