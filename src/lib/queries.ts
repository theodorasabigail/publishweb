import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createStaticClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { PageBlock, PageRecord } from "@/lib/blocks";
import { sortVariants } from "@/lib/product";
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
  categories!products_category_id_fkey ( id, slug, name )
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
  payment_methods: ["Cash", "QRIS", "Transfer BCA", "Card"],
  tier_silver_threshold: 100,
  tier_gold_threshold: 500,
  whatsapp_number: null,
  instagram_url: null,
  contact_email: null,
  seo_title: "Publish Coffee Roasters",
  seo_description:
    "Small-batch Indonesian coffee roasters. Single origin, blends, and custom roasting.",
  og_image_url: null,
  origin_contact_name: null,
  origin_phone: null,
  origin_address: null,
  origin_city: null,
  origin_province: null,
  origin_postal_code: null,
  origin_area_code: null,
  origin_note: null,
  coming_soon_eyebrow: null,
  coming_soon_title: null,
  coming_soon_body: null,
  coming_soon_note: null,
  coming_soon_contact_line: null,
  resend_audience_id: null,
  courier_variance_alert_idr: 10000,
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

  if (options.categoryId) {
    // A coffee counts as belonging to a category if it is that category's
    // primary, OR if the join table records it as an extra. Read the extra
    // set first, then match the primary or the extras.
    const { data: extras } = await supabase
      .from("product_categories")
      .select("product_id")
      .eq("category_id", options.categoryId);
    const extraIds = (extras ?? []).map((row) => (row as { product_id: string }).product_id);

    if (extraIds.length) {
      const list = extraIds.join(",");
      query = query.or(`category_id.eq.${options.categoryId},id.in.(${list})`);
    } else {
      query = query.eq("category_id", options.categoryId);
    }
  }
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

// ---------------------------------------------------------------------------
// Pages and blocks
// ---------------------------------------------------------------------------

export async function getPageBlocks(
  page: string,
  client?: SupabaseClient,
): Promise<PageBlock[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = client ?? createStaticClient();
  const { data } = await supabase
    .from("page_blocks")
    .select("*")
    .eq("page", page)
    .eq("is_active", true)
    .order("sort_order");
  return (data ?? []) as PageBlock[];
}

export async function getPageBySlug(
  slug: string,
  client?: SupabaseClient,
): Promise<PageRecord | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = client ?? createStaticClient();
  const { data } = await supabase
    .from("pages")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  return (data as PageRecord | null) ?? null;
}

/**
 * A built-in page's row, plus its blocks, in one place.
 *
 * Every built-in page needs the same three things, and every one of them has
 * to keep working when the row does not exist -- before 0018 has been run, or
 * if someone deletes it. Null everywhere means "behave exactly as before".
 */
export const getPageContext = cache(
  async (
    slug: string,
  ): Promise<{ page: PageRecord | null; blocks: PageBlock[] }> => {
    if (!isSupabaseConfigured()) return { page: null, blocks: [] };

    const supabase = createStaticClient();
    const [{ data: pageRow }, { data: blockRows }] = await Promise.all([
      supabase.from("pages").select("*").eq("slug", slug).maybeSingle(),
      supabase
        .from("page_blocks")
        .select("*")
        .eq("page", slug)
        .eq("is_active", true)
        .order("sort_order"),
    ]);

    return {
      page: (pageRow as PageRecord | null) ?? null,
      blocks: (blockRows ?? []) as PageBlock[],
    };
  },
);

/**
 * Pages the operator has chosen to put in the menu.
 *
 * Cached per request because the site layout needs it on every page render,
 * and an uncached call there is one query per page view on the storefront —
 * exactly the cost the caching work went to remove.
 */
export const getNavPages = cache(async (): Promise<PageRecord[]> => {
  if (!isSupabaseConfigured()) return [];
  const { data } = await createStaticClient()
    .from("pages")
    .select("*")
    .eq("is_published", true)
    .eq("show_in_nav", true)
    .order("nav_order");
  return (data ?? []) as PageRecord[];
});

/**
 * The top menu.
 *
 * Built from the pages table, so renaming, reordering or hiding a menu item is
 * something the operator does rather than something that needs a deploy.
 *
 * Falls back to the built-in list when the table has nothing to say -- before
 * 0018 has run, or if every page has been hidden. A site with no navigation at
 * all is a worse outcome than a site with the default navigation, so an empty
 * result is treated as "not configured" rather than as "deliberately empty".
 */
export async function getNavigation(): Promise<
  { href: string; label: string }[]
> {
  const pages = await getNavPages();
  if (!pages.length) {
    return [
      { href: "/shop", label: "Shop" },
      { href: "/roasting", label: "Jasa Roasting" },
      { href: "/blog", label: "Journal" },
      { href: "/about", label: "About" },
    ];
  }

  return pages.map((page) => ({
    href: page.href ?? `/p/${page.slug}`,
    label: page.title,
  }));
}
