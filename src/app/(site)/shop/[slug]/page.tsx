import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCart } from "@/components/shop/add-to-cart";
import { ProductCard } from "@/components/shop/product-card";
import { siteUrl } from "@/lib/env";
import { getProductBySlug, getProducts } from "@/lib/queries";
import { lowestPrice, totalStock } from "@/lib/product";
import { productColour } from "@/lib/flavour";
import { contrastText } from "@/lib/utils";

/*
 * Revalidation is a backstop, not the update mechanism: every admin action
 * calls revalidatePath, so edits appear immediately. This timer only catches
 * changes made outside the admin and scheduled posts going live — so it is set
 * long, because each expiry costs a fresh set of database queries.
 */
export const revalidate = 1800;

export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Coffee not found" };

  const description =
    product.seo_description ??
    product.tasting_notes ??
    product.description?.slice(0, 160) ??
    undefined;

  return {
    title: product.seo_title ?? product.name,
    description,
    alternates: { canonical: `/shop/${product.slug}` },
    openGraph: {
      type: "website",
      title: product.seo_title ?? product.name,
      description,
      images: product.og_image_url ?? product.image_url ?? undefined,
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const related = (
    await getProducts({
      categoryId: product.category_id ?? undefined,
      limit: 5,
    })
  )
    .filter((item) => item.id !== product.id)
    .slice(0, 4);

  const price = lowestPrice(product);
  const inStock = totalStock(product) > 0;

  const specs = [
    { label: "Origin", value: product.origin },
    { label: "Process", value: product.process },
    { label: "Varietal", value: product.varietal },
    { label: "Altitude", value: product.masl ? `${product.masl} masl` : null },
    { label: "Roast level", value: product.roast_level },
  ].filter((spec) => Boolean(spec.value));

  // Product structured data, so listings show price and availability (spec §10).
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ?? product.tasting_notes ?? undefined,
    image: product.image_url ? [product.image_url] : undefined,
    brand: { "@type": "Brand", name: "Publish Coffee Roasters" },
    offers: (product.product_variants ?? []).map((variant) => ({
      "@type": "Offer",
      name: `${product.name} — ${variant.size}`,
      price: variant.price_idr,
      priceCurrency: "IDR",
      availability:
        variant.stock > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      url: `${siteUrl()}/shop/${product.slug}`,
    })),
  };

  return (
    <div className="container-page py-10 sm:py-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="text-sm text-sea-800">
        <Link href="/shop" className="hover:underline">
          Shop
        </Link>
        {product.categories && (
          <>
            <span className="mx-2">/</span>
            <Link
              href={`/shop/category/${product.categories.slug}`}
              className="hover:underline"
            >
              {product.categories.name}
            </Link>
          </>
        )}
        <span className="mx-2">/</span>
        <span className="text-sea-800">{product.name}</span>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-2 lg:gap-16">
        <div
          className="relative aspect-square overflow-hidden"
          style={{ backgroundColor: productColour(product) }}
        >
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.image_alt ?? product.name}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          ) : (
            <div
              className="flex h-full items-center justify-center p-10 text-center"
              style={{ color: contrastText(productColour(product)) }}
            >
              <span className="font-serif text-4xl leading-tight opacity-90">
                {product.name}
              </span>
            </div>
          )}
        </div>

        <div>
          {product.origin && (
            <p className="text-xs uppercase tracking-[0.18em] text-sea-800">
              {product.origin}
            </p>
          )}
          <h1 className="mt-2 text-4xl sm:text-5xl">{product.name}</h1>

          {product.tasting_notes && (
            <p className="mt-3 font-serif text-xl text-sea-700">
              {product.tasting_notes}
            </p>
          )}

          {product.description && (
            <p className="mt-5 leading-relaxed text-sea-700">{product.description}</p>
          )}

          <div className="mt-8">
            <AddToCart product={product} />
          </div>

          {specs.length > 0 && (
            <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-sea-200/70 pt-8 text-sm">
              {specs.map((spec) => (
                <div key={spec.label}>
                  <dt className="text-sea-800">{spec.label}</dt>
                  <dd className="mt-0.5 font-medium text-sea-900">{spec.value}</dd>
                </div>
              ))}
            </dl>
          )}

          <p className="mt-8 text-sm text-sea-800">
            {price !== null && inStock
              ? "Roasted to order. Ships within 48 hours, worldwide."
              : "Currently unavailable — new lots are listed most weeks."}
          </p>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="text-2xl sm:text-3xl">You might also like</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
