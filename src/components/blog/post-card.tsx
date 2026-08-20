import Image from "next/image";
import Link from "next/link";
import type { BlogPostWithCategory } from "@/lib/types";
import { formatDate } from "@/lib/utils";

/**
 * How a post is presented outside the article itself.
 *
 * Three shapes, no boxes. The card chrome is gone on purpose — a rounded panel
 * with a shadow around every story is what makes a page of writing read as a
 * dashboard. A magazine separates stories with rules, alignment and space, and
 * lets the headline do the work.
 *
 *   lead     the one story at the top of the section
 *   default  the run of stories beneath it
 *   compact  a text-first index row, image optional
 */
export function PostCard({
  post,
  size = "default",
  priority = false,
}: {
  post: BlogPostWithCategory;
  size?: "default" | "lead" | "compact";
  priority?: boolean;
}) {
  const category = post.blog_categories;

  if (size === "compact") return <CompactRow post={post} />;

  const lead = size === "lead";

  return (
    <article className="group">
      <Link href={`/blog/${post.slug}`} className="block">
        <div
          className={`relative overflow-hidden bg-sea-100 ${
            lead ? "aspect-[3/2] sm:aspect-[2/1]" : "aspect-[4/3]"
          }`}
        >
          {post.cover_image ? (
            <Image
              src={post.cover_image}
              alt={post.cover_alt ?? post.title}
              fill
              priority={priority}
              sizes={lead ? "(max-width: 1024px) 100vw, 1100px" : "(max-width: 768px) 100vw, 45vw"}
              className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
            />
          ) : (
            // No photograph yet. Rather than a grey rectangle, the category
            // colour and name stand in — it still reads as a considered choice.
            <div
              className="flex h-full items-end p-6"
              style={{ backgroundColor: category?.accent_color ?? "#486b73" }}
            >
              <span className="font-serif text-2xl text-cream/90">
                {category?.name ?? "Journal"}
              </span>
            </div>
          )}
        </div>

        <div className={lead ? "mt-6" : "mt-5"}>
          {category && (
            <span className="kicker" style={{ color: category.accent_color }}>
              {category.name}
            </span>
          )}

          <h3
            className={`mt-2.5 group-hover:underline group-hover:decoration-1 group-hover:underline-offset-[6px] ${
              lead ? "text-3xl sm:text-5xl" : "text-2xl"
            }`}
          >
            {post.title}
          </h3>

          {post.excerpt && (
            <p
              className={`mt-3 leading-relaxed text-sea-800 ${
                lead ? "max-w-2xl text-lg" : "line-clamp-2 text-base"
              }`}
            >
              {post.excerpt}
            </p>
          )}

          <Byline post={post} className="mt-3" />
        </div>
      </Link>
    </article>
  );
}

/**
 * A text-first index row.
 *
 * The Radar column: no picture needed, just enough to decide. Rules between
 * rows rather than around them, so a run of ten reads as one list instead of
 * ten objects.
 */
function CompactRow({ post }: { post: BlogPostWithCategory }) {
  const category = post.blog_categories;

  return (
    <article className="group border-b border-sea-200 py-5 first:border-t">
      <Link href={`/blog/${post.slug}`} className="flex items-baseline gap-5">
        <div className="min-w-0 flex-1">
          {category && (
            <span className="kicker" style={{ color: category.accent_color }}>
              {category.name}
            </span>
          )}
          <h3 className="mt-1.5 text-xl group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">
            {post.title}
          </h3>
          <Byline post={post} className="mt-2" />
        </div>
      </Link>
    </article>
  );
}

export function Byline({
  post,
  className = "",
}: {
  post: BlogPostWithCategory;
  className?: string;
}) {
  return (
    <p className={`meta text-sea-800 ${className}`}>
      <time dateTime={post.published_at ?? undefined}>
        {formatDate(post.published_at)}
      </time>
      {post.reading_minutes ? (
        <>
          <span className="mx-1.5 text-sea-400">&middot;</span>
          {post.reading_minutes} min read
        </>
      ) : null}
    </p>
  );
}
