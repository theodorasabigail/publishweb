import { siteUrl } from "@/lib/env";
import { markdownToPlainText } from "@/lib/markdown";
import { getPublishedPosts } from "@/lib/queries";
import { truncate } from "@/lib/utils";

export const revalidate = 900;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const base = siteUrl();
  const posts = await getPublishedPosts({ limit: 50 });

  const items = posts
    .map((post) => {
      const url = `${base}/blog/${post.slug}`;
      const summary =
        post.excerpt ?? truncate(markdownToPlainText(post.body), 300);

      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <description>${escapeXml(summary)}</description>
      <pubDate>${new Date(post.published_at ?? post.created_at).toUTCString()}</pubDate>
      <author>${escapeXml(post.author_name)}</author>
${(post.tags ?? []).map((tag) => `      <category>${escapeXml(tag)}</category>`).join("\n")}
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>The Journal — Publish Coffee Roasters</title>
    <link>${escapeXml(`${base}/blog`)}</link>
    <description>Roasting notes, origin trips and brewing arguments from a small Indonesian roastery.</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(`${base}/rss.xml`)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=900, s-maxage=900",
    },
  });
}
