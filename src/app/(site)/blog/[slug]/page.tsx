import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostCard } from "@/components/blog/post-card";
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
    <article className="pb-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="container-page max-w-3xl pt-12">
        <nav className="text-sm text-sea-800">
          <Link href="/blog" className="hover:underline">
            Journal
          </Link>
          {category && (
            <>
              <span className="mx-2">/</span>
              <Link href={`/blog/category/${category.slug}`} className="hover:underline">
                {category.name}
              </Link>
            </>
          )}
        </nav>

        <header className="mt-6">
          {category && (
            <span
              className="badge"
              style={{
                backgroundColor: `${category.accent_color}1a`,
                color: category.accent_color,
              }}
            >
              {category.name}
            </span>
          )}

          <h1 className="mt-4 text-4xl leading-[1.1] sm:text-5xl">{post.title}</h1>

          {post.excerpt && (
            <p className="mt-5 font-serif text-xl leading-relaxed text-sea-800">
              {post.excerpt}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-sea-800">
            <span>{post.author_name}</span>
            <span>·</span>
            <time dateTime={post.published_at ?? undefined}>
              {formatDate(post.published_at)}
            </time>
            {post.reading_minutes && (
              <>
                <span>·</span>
                <span>{post.reading_minutes} min read</span>
              </>
            )}
          </div>
        </header>
      </div>

      {post.cover_image && (
        <div className="container-page mt-10 max-w-5xl">
          <div className="relative aspect-[16/9] overflow-hidden rounded-3xl bg-sea-100">
            <Image
              src={post.cover_image}
              alt={post.cover_alt ?? post.title}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 1024px"
              className="object-cover"
            />
          </div>
        </div>
      )}

      <div className="container-page mt-12 max-w-3xl">
        <div
          className="prose prose-lg max-w-none prose-headings:font-serif prose-headings:tracking-tight
                     prose-a:text-sea-800 prose-a:underline-offset-4 prose-blockquote:border-l-sea-400
                     prose-blockquote:font-serif prose-blockquote:not-italic prose-blockquote:text-sea-700
                     prose-strong:text-ink prose-img:rounded-2xl"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {post.tags.length > 0 && (
          <div className="mt-12 flex flex-wrap gap-2 border-t border-sea-200/70 pt-8">
            {post.tags.map((tag) => (
              <Link
                key={tag}
                href={`/blog/tag/${encodeURIComponent(tag)}`}
                className="badge border border-sea-200 bg-white text-sea-800 hover:border-sea-400"
              >
                #{tag}
              </Link>
            ))}
          </div>
        )}
      </div>

      {more.length > 0 && (
        <section className="container-page mt-20 max-w-5xl border-t border-sea-200/70 pt-12">
          <h2 className="text-2xl">Keep reading</h2>
          <div className="mt-8 grid gap-8 sm:grid-cols-3">
            {more.map((item) => (
              <PostCard key={item.id} post={item} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
