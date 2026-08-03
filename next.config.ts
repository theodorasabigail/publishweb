import type { NextConfig } from "next";

const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
      : [{ protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" }],

    // ---------------------------------------------------------------------
    // Everything below exists to keep Supabase egress low.
    //
    // Vercel's image optimiser fetches the original from Supabase once per
    // (url, width, quality) combination, then serves its own cached copy. So
    // the number of *distinct combinations* is the number of times Supabase
    // gets hit for a given photo. The defaults allow eight widths at any
    // quality, which is far more granularity than this site's layouts use.
    // ---------------------------------------------------------------------

    // Four breakpoints instead of eight. The grid is at most four columns, so
    // nothing between these values renders meaningfully differently.
    deviceSizes: [640, 828, 1200, 1920],
    imageSizes: [64, 128, 256, 384],

    // One quality setting, so a stray `quality` prop cannot quietly double the
    // number of origin fetches.
    qualities: [75],

    // Hold each optimised variant for 31 days. Replacing a photo in the admin
    // writes a new path, so the URL changes and this never serves a stale
    // image -- it only stops needless re-fetches of unchanged ones.
    minimumCacheTTL: 60 * 60 * 24 * 31,

    formats: ["image/webp"],
  },
};

export default nextConfig;
