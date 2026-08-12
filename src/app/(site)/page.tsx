import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Flame, Globe, Package } from "lucide-react";
import { PostCard } from "@/components/blog/post-card";
import { EmptyState } from "@/components/empty-state";
import { ProductCard } from "@/components/shop/product-card";
import { isSupabaseConfigured } from "@/lib/env";
import { getCategories, getProducts, getPublishedPosts, getSiteSettings } from "@/lib/queries";

/*
 * Revalidation is a backstop, not the update mechanism: every admin action
 * calls revalidatePath, so edits appear immediately. This timer only catches
 * changes made outside the admin and scheduled posts going live — so it is set
 * long, because each expiry costs a fresh set of database queries.
 */
export const revalidate = 3600;

export default async function HomePage() {
  if (!isSupabaseConfigured()) return <NotConnectedYet />;

  const [settings, categories, featured, latest, posts] = await Promise.all([
    getSiteSettings(),
    getCategories(),
    getProducts({ featuredOnly: true, limit: 4 }),
    getProducts({ limit: 8 }),
    getPublishedPosts({ limit: 3 }),
  ]);

  // The operator picks which categories appear here, and in what order.
  const homepageCategories = settings.homepage_category_ids.length
    ? settings.homepage_category_ids
        .map((id) => categories.find((category) => category.id === id))
        .filter((category): category is NonNullable<typeof category> => Boolean(category))
    : categories.filter((category) => category.show_on_homepage);

  const shelf = featured.length ? featured : latest.slice(0, 4);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-bark-200/70 bg-bark-950 text-cream">
        {settings.hero_image && (
          <Image
            src={settings.hero_image}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-40"
          />
        )}
        <div className="container-page relative py-24 sm:py-32">
          <p className="text-xs uppercase tracking-[0.2em] text-bark-300">
            PT Aroma Pulau Arunika
          </p>
          <h1 className="mt-4 max-w-3xl text-5xl leading-[1.05] sm:text-7xl">
            {settings.hero_title}
          </h1>
          {settings.hero_subtitle && (
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-bark-200">
              {settings.hero_subtitle}
            </p>
          )}
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href={settings.hero_cta_href ?? "/shop"}
              className="btn bg-cream text-bark-950 hover:bg-white"
            >
              {settings.hero_cta_label ?? "Shop the roast list"}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/roasting"
              className="btn border border-bark-600 text-cream hover:bg-bark-900"
            >
              Custom roasting
            </Link>
          </div>
        </div>
      </section>

      {/* Value strip */}
      <section className="border-b border-bark-200/70 bg-white">
        <div className="container-page grid gap-8 py-10 sm:grid-cols-3">
          {[
            { icon: Flame, title: "Roasted to order", body: "Bags go out within 48 hours of coming off the drum." },
            { icon: Package, title: "Three sizes", body: "100g to try, 200g for the week, 1kg for the café." },
            { icon: Globe, title: "Ships worldwide", body: "Flat-rate international zones, no surprise fees at checkout." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-3.5">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-bark-500" />
              <div>
                <p className="font-medium">{title}</p>
                <p className="mt-1 text-sm text-bark-600">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Featured coffee */}
      <section className="container-page py-16 sm:py-20">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl sm:text-4xl">On the shelf</h2>
            <p className="mt-2 text-bark-600">What we are roasting right now.</p>
          </div>
          <Link href="/shop" className="btn-ghost shrink-0">
            All coffee <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {shelf.length ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {shelf.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="mt-8">
            <EmptyState
              title="No coffee listed yet"
              description="Add your first product from the admin dashboard and it will appear here."
              actionLabel="Open the admin"
              actionHref="/admin/products"
            />
          </div>
        )}
      </section>

      {/* Categories */}
      {homepageCategories.length > 0 && (
        <section className="border-y border-bark-200/70 bg-white py-16 sm:py-20">
          <div className="container-page">
            <h2 className="text-3xl sm:text-4xl">Browse by style</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {homepageCategories.map((category) => (
                <Link
                  key={category.id}
                  href={`/shop/category/${category.slug}`}
                  className="card group flex flex-col p-6 transition-colors hover:border-bark-400"
                >
                  <p className="font-serif text-xl">{category.name}</p>
                  {category.description && (
                    <p className="mt-2 line-clamp-3 text-sm text-bark-600">
                      {category.description}
                    </p>
                  )}
                  <span className="mt-4 inline-flex items-center gap-1 text-sm text-bark-700 group-hover:gap-2">
                    Browse <ArrowRight className="h-3.5 w-3.5 transition-all" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Roasting service */}
      <section className="container-page py-16 sm:py-20">
        <div className="overflow-hidden rounded-3xl bg-bark-900 px-8 py-14 text-cream sm:px-14">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.2em] text-bark-400">
              Jasa Roasting
            </p>
            <h2 className="mt-3 text-3xl sm:text-4xl">
              Bring us your green beans.
            </h2>
            <p className="mt-4 text-bark-200">
              We roast to order for cafés, small brands, and anyone with a sack of
              green coffee and no drum. Tell us the origin, the volume, and the
              roast level you are after, and we will come back with a quote.
            </p>
            <Link href="/roasting" className="btn mt-7 bg-cream text-bark-950 hover:bg-white">
              Request a quote <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Journal */}
      {posts.length > 0 && (
        <section className="container-page pb-20">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl sm:text-4xl">From the Journal</h2>
              <p className="mt-2 text-bark-600">
                Roasting notes, origin trips, and brewing arguments.
              </p>
            </div>
            <Link href="/blog" className="btn-ghost shrink-0">
              Read all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

/** Shown on the very first deploy, before Supabase keys exist. Vercel's build
 *  succeeds and the operator gets instructions instead of a crash. */
function NotConnectedYet() {
  return (
    <div className="container-page py-24">
      <div className="card mx-auto max-w-2xl p-10">
        <h1 className="text-3xl">The site is deployed. One step to go.</h1>
        <p className="mt-4 text-bark-600">
          Supabase is not connected yet, so there is no coffee to show. Add these
          environment variables in Vercel, then redeploy:
        </p>
        <ul className="mt-5 space-y-2 font-mono text-sm text-bark-800">
          <li>NEXT_PUBLIC_SUPABASE_URL</li>
          <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
          <li>SUPABASE_SERVICE_ROLE_KEY</li>
        </ul>
        <p className="mt-5 text-sm text-bark-600">
          Step-by-step instructions, including where to find each value, are in{" "}
          <code className="rounded bg-bark-100 px-1.5 py-0.5">docs/OPERATOR_SETUP.md</code>{" "}
          in the project repository.
        </p>
      </div>
    </div>
  );
}
