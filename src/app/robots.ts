import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Nothing here is secret, but none of it belongs in an index either.
      disallow: ["/admin", "/account", "/checkout", "/cart", "/order/", "/api/"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
