import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createStaticClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type {
  BlogCategory,
  BlogPostWithCategory,
  Category,
  ProductWithVariants,
  SiteSettings,
} from "@/lib/types";

const PRODUCT_SELECT = `
  *,
  product_variants (*),
  categories ( id, slug, name )
`;

const POST_SELECT = `
  *,
  blog_categories ( id, slug, name, accent_color )
`;

/** Defaults used before the operator has connected Supabase, so the very first
 *  Vercel deploy renders instead of crashing (spec §14, step 1). */
export const FALLBACK_SETTINGS: SiteSettings = {
  id: true,
  hero_image: null,
  hero_title: "Coffee, published.",
  hero_subtitle:
    "A small roastery in Indonesia. Rotating single origins, blends we actually drink, and a custom roasting service for your own green beans.",
  hero_cta_label: "Shop the roast list",
  hero_cta_href: "/shop",
  banner_enabled: false,
  banner_image: null,
  banner_text: null,
  banner_link: null,
  homepage_category_ids: [],
  featured_post_id: null,
  announcement_note: null,
  loyalty_rupiah_per_point: 10000,
  tier_silver_threshold: 100,
  tier_gold_threshold: 500,
  whatsapp_number: null,
  instagram_url: null,
  contact_email: null,
  seo_title: "Publish Coffee Roasters",
  seo_description:
    "Small-batch Indonesian coffee roasters. Single origin, blends, and custom roasting.",
  og_image_url: null,
  updated_at: new Date().toISOString(),
};

/**
 * Site settings, deduped per render pass.
 *
 * Both the root layout's generateMetadata and the site layout need these, and
 * without React's cache() that is two identical queries for every single page
 * render. Wrapped, it is one.
 */
const fetchSiteSettings = cache(async (): Promise<SiteSettings> => {
  const { data } = await createStaticClient()
    .from("site_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  return (data as SiteSettings | null) ?? FALLBACK_SETTINGS;
});

export async function getSiteSettings(
  client?: SupabaseClient,
): Promise<SiteSettings> {
  if (!isSupabaseConfigured()) return FALLBACK_SETTINGS;

  // A caller passing its own client (the admin, on the service role) needs that
  // client used, so it bypasses the shared per-request cache.
  if (client) {
    const { data } = await client.from("site_settings").select("*").eq("id", true).maybeSingle();
    return (data as SiteSettings | null) ?? FALLBACK_SETTINGS;
  }

  return fetchSiteSettings();
}

export async function getCategories(client?: SupabaseClient): Promise<Category[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = client ?? createStaticClient();
  const { data } = await supabase.from("categories").select("*").order("sort_order");
  return (data ?? []) as Category[];
}

export async function getCategoryBySlug(
  slug: string,
  client?: SupabaseClient,
): Promise<Category | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = client ?? createStaticClient();
  const { data } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return (data as Category | null) ?? null;
}

export async function getProducts(
  options: { categoryId?: string; featuredOnly?: boolean; limit?: number } = {},
  client?: SupabaseClient,
): Promise<ProductWithVariants[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = client ?? createStaticClient();

  let query = supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("is_active", true)
    .order("sort_order")
    .order("created_at", { ascending: false });

  if (options.categoryId) query = query.eq("category_id", options.categoryId);
  if (options.featuredOnly) query = query.eq("is_featured", true);
  if (options.limit) query = query.limit(options.limit);

  const { data } = await query;
  return sortVariants((data ?? []) as ProductWithVariants[]);
}

export async function getProductBySlug(
  slug: string,
  client?: SupabaseClient,
): Promise<ProductWithVariants | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = client ?? createStaticClient();
  const { data } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (!data) return null;
  return sortVariants([data as ProductWithVariants])[0];
}

/** 100g before 200g before 1kg, whatever order Postgres returns them in. */
function sortVariants(products: ProductWithVariants[]): ProductWithVariants[] {
  const order: Record<string, number> = { "100g": 0, "200g": 1, "1kg": 2 };
  return products.map((product) => ({
    ...product,
    product_variants: [...(product.product_variants ?? [])]
      .filter((variant) => variant.is_active)
      .sort((a, b) => (order[a.size] ?? 9) - (order[b.size] ?? 9)),
  }));
}

export function lowestPrice(product: ProductWithVariants): number | null {
  const prices = (product.product_variants ?? []).map((v) => v.price_idr);
  return prices.length ? Math.min(...prices) : null;
}

export function totalStock(product: ProductWithVariants): number {
  return (product.product_variants ?? []).reduce((sum, v) => sum + v.stock, 0);
}

// ---------------------------------------------------------------------------
// Blog
// ---------------------------------------------------------------------------

export async function getBlogCategories(
  client?: SupabaseClient,
): Promise<BlogCategory[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = client ?? createStaticClient();
  const { data } = await supabase.from("blog_categories").select("*").order("sort_order");
  return (data ?? []) as BlogCategory[];
}

export async function getPublishedPosts(
  options: { categoryId?: string; tag?: string; limit?: number; featuredOnly?: boolean } = {},
  client?: SupabaseClient,
): Promise<BlogPostWithCategory[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = client ?? createStaticClient();

  let query = supabase
    .from("blog_posts")
    .select(POST_SELECT)
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false });

  if (options.categoryId) query = query.eq("blog_category_id", options.categoryId);
  if (options.tag) query = query.contains("tags", [options.tag]);
  if (options.featuredOnly) query = query.eq("is_featured", true);
  if (options.limit) query = query.limit(options.limit);

  const { data } = await query;
  return (data ?? []) as BlogPostWithCategory[];
}

export async function getPostBySlug(
  slug: string,
  client?: SupabaseClient,
): Promise<BlogPostWithCategory | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = client ?? createStaticClient();
  const { data } = await supabase
    .from("blog_posts")
    .select(POST_SELECT)
    .eq("slug", slug)
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .maybeSingle();
  return (data as BlogPostWithCategory | null) ?? null;
}

export async function getBlogCategoryBySlug(
  slug: string,
  client?: SupabaseClient,
): Promise<BlogCategory | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = client ?? createStaticClient();
  const { data } = await supabase
    .from("blog_categories")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return (data as BlogCategory | null) ?? null;
}

/** Every tag in use, most common first. Powers the archive's tag rail. */
export async function getAllTags(client?: SupabaseClient): Promise<string[]> {
  const posts = await getPublishedPosts({}, client);
  const counts = new Map<string, number>();
  for (const post of posts) {
    for (const tag of post.tags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag);
}
