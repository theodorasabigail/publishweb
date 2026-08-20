import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostCard } from "@/components/blog/post-card";
import { journalFontClassNames } from "@/lib/fonts";
import { siteUrl } from "@/lib/env";
import { markdownToPlainText, renderMarkdown } from "@/lib/markdown";
import { getPostBySlug, getPublishedPosts } from "@/lib/queries";
import { formatDate, truncate } from "@/lib/utils";

/*
 * Revalidation is a backstop, not the update mechanism: every admin action
 * calls revalidatePath, so edits appear immediately. This timer only catches
 * changes made outside the admin and scheduled posts going live — so it is set
 * long, because each expiry costs a fresh set of database queries.
 */
export const revalidate = 3600;

export async function generateStaticParams() {
  const posts = await getPublishedPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: "Post not found" };

  const description =
    post.seo_description ??
    post.excerpt ??
    truncate(markdownToPlainText(post.body), 160);

  return {
    title: post.seo_title ?? post.title,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.seo_title ?? post.title,
      description,
      publishedTime: post.published_at ?? undefined,
      authors: [post.author_name],
      tags: post.tags,
      images: post.og_image_url ?? post.cover_image ?? undefined,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const category = post.blog_categories;
  const html = renderMarkdown(post.body);

  const more = (
    await getPublishedPosts({
      categoryId: post.blog_category_id ?? undefined,
      limit: 4,
    })
  )
    .filter((item) => item.id !== post.id)
    .slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt ?? undefined,
    image: post.cover_image ? [post.cover_image] : undefined,
    datePublished: post.published_at ?? undefined,
    dateModified: post.updated_at,
    author: { "@type": "Person", name: post.author_name },
    publisher: {
      "@type": "Organization",
      name: "Publish Coffee Roasters",
    },
    mainEntityOfPage: `${siteUrl()}/blog/${post.slug}`,
  };

  return (
    <article className={`journal ${journalFontClassNames} pb-24`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* --- Headline block -------------------------------------------------
          Centred and narrow above a wide photograph. The asymmetry between the
          two is what gives an article a front page rather than a top edge. */}
      <div className="container-page max-w-3xl pt-10 text-center">
        <nav className="meta text-sea-800">
          <Link href="/blog" className="hover:text-ink">
            The Journal
          </Link>
          {category && (
            <>
              <span className="mx-2 text-sea-400">/</span>
              <Link
                href={`/blog/category/${category.slug}`}
                className="hover:text-ink"
              >
                {category.name}
              </Link>
            </>
          )}
        </nav>

        {category && (
          <p className="kicker mt-8" style={{ color: category.accent_color }}>
            {category.name}
          </p>
        )}

        <h1 className="mt-4 text-4xl sm:text-6xl">{post.title}</h1>

        {/* The standfirst: one sentence, larger than the body, that decides
            whether someone reads the rest. Set apart from both. */}
        {post.excerpt && (
          <p className="mx-auto mt-6 max-w-2xl text-xl leading-relaxed text-sea-800">
            {post.excerpt}
          </p>
        )}

        <div className="mt-8 inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-y border-sea-200 py-3">
          <span className="kicker text-ink">{post.author_name}</span>
          <span className="text-sea-400">&middot;</span>
          <time className="meta text-sea-800" dateTime={post.published_at ?? undefined}>
            {formatDate(post.published_at)}
          </time>
          {post.reading_minutes && (
            <>
              <span className="text-sea-400">&middot;</span>
              <span className="meta text-sea-800">
                {post.reading_minutes} min read
              </span>
            </>
          )}
        </div>
      </div>

      {post.cover_image && (
        <figure className="container-page mt-12 max-w-5xl">
          <div className="relative aspect-[3/2] overflow-hidden bg-sea-100 sm:aspect-[2/1]">
            <Image
              src={post.cover_image}
              alt={post.cover_alt ?? post.title}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 1024px"
              className="object-cover"
            />
          </div>
          {post.cover_alt && (
            <figcaption className="meta mt-3 text-sea-800">
              {post.cover_alt}
            </figcaption>
          )}
        </figure>
      )}

      {/* --- Body -----------------------------------------------------------
          `article-body` carries the measure, leading, drop cap and the rule
          that lets images break wider than the text. See globals.css. */}
      <div className="container-page mt-14 max-w-5xl">
        <div
          className="article-body mx-auto"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {post.tags.length > 0 && (
          <div className="mx-auto mt-14 max-w-[34em] border-t border-sea-200 pt-6">
            <p className="kicker text-sea-800">Filed under</p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
              {post.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/blog/tag/${encodeURIComponent(tag)}`}
                  className="meta text-sea-800 underline decoration-sea-300 underline-offset-4 hover:text-ink hover:decoration-ink"
                >
                  {tag}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {more.length > 0 && (
        <section className="container-page mt-24">
          <h2 className="kicker border-b border-ink pb-3 text-ink">
            Keep reading
          </h2>
          <div className="mt-10 grid gap-x-10 gap-y-12 sm:grid-cols-3">
            {more.map((item) => (
              <PostCard key={item.id} post={item} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
