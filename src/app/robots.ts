import type { MetadataRoute } from "next";
import { isComingSoon } from "@/lib/coming-soon";
import { siteUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  // While the shop is hidden there is nothing worth indexing, and letting a
  // coming-soon page into search results means displacing it later.
  if (isComingSoon()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

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
