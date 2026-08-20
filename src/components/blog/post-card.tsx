import Image from "next/image";
import Link from "next/link";
import type { BlogPostWithCategory } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export function PostCard({
  post,
  size = "default",
}: {
  post: BlogPostWithCategory;
  size?: "default" | "large";
}) {
  const category = post.blog_categories;
  const large = size === "large";

  return (
    <article className="group">
      <Link href={`/blog/${post.slug}`} className="block">
        <div
          className={`relative overflow-hidden rounded-2xl ${large ? "aspect-[16/9]" : "aspect-[3/2]"}`}
          style={{ backgroundColor: category?.accent_color ?? "#486b73" }}
        >
          {post.cover_image ? (
            <Image
              src={post.cover_image}
              alt={post.cover_alt ?? post.title}
              fill
              sizes={large ? "100vw" : "(max-width: 768px) 100vw, 33vw"}
              className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full items-end p-6">
              <span className="font-serif text-2xl text-cream/90">
                {category?.name ?? "Journal"}
              </span>
            </div>
          )}
        </div>

        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-sea-800">
            {category && (
              <span
                className="badge"
                style={{ backgroundColor: `${category.accent_color}1a`, color: category.accent_color }}
              >
                {category.name}
              </span>
            )}
            <time dateTime={post.published_at ?? undefined}>
              {formatDate(post.published_at)}
            </time>
            {post.reading_minutes && <span>· {post.reading_minutes} min read</span>}
          </div>

          <h3
            className={`mt-2 font-semibold leading-snug group-hover:underline group-hover:underline-offset-4 ${
              large ? "text-2xl sm:text-3xl" : "text-lg"
            }`}
          >
            {post.title}
          </h3>

          {post.excerpt && (
            <p className={`mt-2 text-sea-800 ${large ? "text-base" : "line-clamp-3 text-sm"}`}>
              {post.excerpt}
            </p>
          )}
        </div>
      </Link>
    </article>
  );
}
