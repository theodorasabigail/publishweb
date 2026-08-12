import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";
import {
  getBlogCategories,
  getCategories,
  getProducts,
  getPublishedPosts,
} from "@/lib/queries";

/*
 * Revalidation is a backstop, not the update mechanism: every admin action
 * calls revalidatePath, so edits appear immediately. This timer only catches
 * changes made outside the admin and scheduled posts going live — so it is set
 * long, because each expiry costs a fresh set of database queries.
 */
export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();

  const [products, categories, posts, blogCategories] = await Promise.all([
    getProducts(),
    getCategories(),
    getPublishedPosts(),
    getBlogCategories(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/shop`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/blog`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/blog/categories`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/roasting`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/shipping`, changeFrequency: "monthly", priority: 0.4 },
  ];

  return [
    ...staticRoutes,
    ...products.map((product) => ({
      url: `${base}/shop/${product.slug}`,
      lastModified: new Date(product.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...categories.map((category) => ({
      url: `${base}/shop/category/${category.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...posts.map((post) => ({
      url: `${base}/blog/${post.slug}`,
      lastModified: new Date(post.updated_at),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...blogCategories.map((category) => ({
      url: `${base}/blog/category/${category.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];
}
