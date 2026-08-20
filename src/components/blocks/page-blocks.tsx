import Image from "next/image";
import Link from "next/link";
import { ProductCard } from "@/components/shop/product-card";
import { getProducts } from "@/lib/queries";
import { isBlockEmpty, type PageBlock } from "@/lib/blocks";
import { cn } from "@/lib/utils";

/**
 * Drawing the operator's blocks.
 *
 * Every layout here is built to the same rules, which are what the whole thing
 * is for: pictures run to the edge of the screen rather than sitting in a
 * rounded box; type is small, quiet and set in a narrow column beside a lot of
 * space; there is exactly one loud thing per block. Restraint is the design,
 * and it holds no matter which blocks get chosen or in what order.
 */
export async function PageBlocks({ blocks }: { blocks: PageBlock[] }) {
  const visible = blocks.filter((block) => block.is_active && !isBlockEmpty(block));
  if (!visible.length) return null;

  return (
    <>
      {visible.map((block) => (
        <Block key={block.id} block={block} />
      ))}
    </>
  );
}

async function Block({ block }: { block: PageBlock }) {
  const c = block.content ?? {};

  switch (block.block_type) {
    case "split":
      return <SplitBlock content={c} />;
    case "full_image":
      return <FullImageBlock content={c} />;
    case "statement":
      return <StatementBlock content={c} />;
    case "gallery":
      return <GalleryBlock content={c} />;
    case "text":
      return <TextBlock content={c} />;
    case "products":
      return <ProductsBlock content={c} />;
    case "rule":
      return (
        <div className="container-page py-10">
          <hr className="border-sea-200" />
        </div>
      );
    default:
      return null;
  }
}

type Content = Record<string, string>;

/**
 * The picture, or the loop.
 *
 * Video is muted, looped and inline, because that is the only kind of moving
 * image a shop should autoplay — anything with sound is an ambush. `poster`
 * carries the still, so the block is composed before a single byte of video
 * has arrived and stays composed if it never does.
 *
 * `preload="metadata"` rather than `auto` is deliberate and is about the bill:
 * video is served straight from Supabase storage with no optimiser and no
 * cache layer in front of it, so a 4 MB loop preloaded by a thousand visitors
 * is 4 GB against a 5 GB monthly allowance. Metadata-only defers the download
 * until the browser actually intends to play.
 */
function Media({
  content,
  priority = false,
  sizes,
  className = "object-cover",
}: {
  content: Content;
  priority?: boolean;
  sizes: string;
  className?: string;
}) {
  if (content.video) {
    return (
      <video
        className={cn("absolute inset-0 h-full w-full", className)}
        src={content.video}
        poster={content.image || undefined}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={content.alt || undefined}
      />
    );
  }

  if (!content.image) return null;

  return (
    <Image
      src={content.image}
      alt={content.alt ?? ""}
      fill
      priority={priority}
      sizes={sizes}
      className={className}
    />
  );
}

/** The one call to action a block is allowed. */
function Cta({ content, tone }: { content: Content; tone?: "dark" }) {
  if (!content.ctaLabel) return null;
  return (
    <Link
      href={content.ctaHref || "/shop"}
      // Underlined text, not a filled pill. On a quiet page a button shouts;
      // a rule under a word is enough and leaves the photograph in charge.
      className={cn(
        "mt-7 inline-block border-b pb-1 text-xs font-semibold uppercase tracking-[0.14em] transition-colors",
        tone === "dark"
          ? "border-cream/50 text-cream hover:border-cream"
          : "border-ink/30 text-ink hover:border-ink",
      )}
    >
      {content.ctaLabel}
    </Link>
  );
}

function Eyebrow({ children, tone }: { children: string; tone?: "dark" }) {
  return (
    <p
      className={cn(
        "text-xs font-semibold uppercase tracking-[0.16em]",
        tone === "dark" ? "text-cream/70" : "text-sea-800",
      )}
    >
      {children}
    </p>
  );
}

/**
 * Picture one side, words the other, both running to the edge.
 *
 * The picture takes exactly half and bleeds off the screen; the words sit in a
 * narrow column inside the other half rather than filling it, so the space
 * between them is doing the work.
 */
function SplitBlock({ content }: { content: Content }) {
  const dark = content.tone === "dark";
  const imageLeft = content.side !== "right";

  return (
    <section
      className={cn(
        "grid items-stretch lg:grid-cols-2",
        dark ? "bg-sea-950 text-cream" : content.tone === "white" ? "bg-white" : "bg-cream",
      )}
    >
      {(content.image || content.video) && (
        <div
          className={cn(
            "relative aspect-[4/3] overflow-hidden lg:aspect-auto lg:min-h-[38rem]",
            imageLeft ? "lg:order-1" : "lg:order-2",
          )}
        >
          <Media content={content} sizes="(max-width: 1024px) 100vw, 50vw" />
        </div>
      )}

      <div
        className={cn(
          "flex items-center px-6 py-16 sm:px-12 lg:py-24",
          imageLeft ? "lg:order-2" : "lg:order-1",
        )}
      >
        <div className="max-w-md">
          {content.eyebrow && (
            <Eyebrow tone={dark ? "dark" : undefined}>{content.eyebrow}</Eyebrow>
          )}
          {content.heading && (
            <h2 className="mt-5 text-4xl uppercase leading-[0.95] tracking-[-0.02em] sm:text-5xl">
              {content.heading}
            </h2>
          )}
          {content.body && (
            <p
              className={cn(
                "mt-5 whitespace-pre-line leading-relaxed",
                dark ? "text-sea-200" : "text-sea-800",
              )}
            >
              {content.body}
            </p>
          )}
          <Cta content={content} tone={dark ? "dark" : undefined} />
        </div>
      </div>
    </section>
  );
}

function FullImageBlock({ content }: { content: Content }) {
  const height =
    content.height === "full"
      ? "min-h-[calc(100vh-4rem)]"
      : content.height === "short"
        ? "min-h-[22rem]"
        : "min-h-[38rem]";

  const align =
    content.align === "center"
      ? "items-center justify-center text-center"
      : content.align === "bottom-right"
        ? "items-end justify-end text-left"
        : "items-end justify-start text-left";

  const hasWords = Boolean(content.heading || content.body || content.eyebrow);

  return (
    <section className={cn("relative flex overflow-hidden", height, align)}>
      <Media content={content} priority sizes="100vw" />

      {/* A gradient only where the words are, rather than a flat wash over the
          whole picture — the photograph stays a photograph. */}
      {hasWords && (
        <div
          aria-hidden
          className={cn(
            "absolute inset-0",
            content.align === "center"
              ? "bg-ink/35"
              : "bg-gradient-to-t from-ink/70 via-ink/20 to-transparent",
          )}
        />
      )}

      {hasWords && (
        <div className="relative w-full px-6 py-14 sm:px-12 sm:py-20">
          <div className={cn("max-w-xl", content.align === "center" && "mx-auto")}>
            {content.eyebrow && <Eyebrow tone="dark">{content.eyebrow}</Eyebrow>}
            {content.heading && (
              <h2 className="mt-4 text-5xl uppercase leading-[0.92] tracking-[-0.02em] text-cream sm:text-7xl">
                {content.heading}
              </h2>
            )}
            {content.body && (
              <p className="mt-4 max-w-md whitespace-pre-line leading-relaxed text-cream/85">
                {content.body}
              </p>
            )}
            <Cta content={content} tone="dark" />
          </div>
        </div>
      )}
    </section>
  );
}

function StatementBlock({ content }: { content: Content }) {
  return (
    <section className="container-page py-24 text-center sm:py-32">
      {content.eyebrow && <Eyebrow>{content.eyebrow}</Eyebrow>}
      {content.heading && (
        <h2 className="mx-auto mt-6 max-w-4xl whitespace-pre-line text-4xl uppercase leading-[0.95] tracking-[-0.02em] sm:text-6xl">
          {content.heading}
        </h2>
      )}
      {content.body && (
        <p className="mx-auto mt-6 max-w-xl whitespace-pre-line leading-relaxed text-sea-800">
          {content.body}
        </p>
      )}
      <Cta content={content} />
    </section>
  );
}

function GalleryBlock({ content }: { content: Content }) {
  const images = [content.image1, content.image2, content.image3, content.image4]
    .map((src, index) => ({ src, alt: content[`alt${index + 1}`] ?? "" }))
    .filter((entry) => entry.src);

  if (!images.length) return null;

  const aspect =
    content.shape === "square"
      ? "aspect-square"
      : content.shape === "landscape"
        ? "aspect-[4/3]"
        : "aspect-[3/4]";

  return (
    <section className="py-16 sm:py-20">
      {content.heading && (
        <h2 className="mb-10 text-center text-xs font-semibold uppercase tracking-[0.16em] text-ink">
          {content.heading}
        </h2>
      )}
      {/* A one-pixel gap, not a gutter. Pictures that nearly touch read as one
          composition; pictures in a grid of cards read as a list. */}
      <div
        className={cn(
          "grid gap-px bg-sea-200",
          images.length === 2 && "sm:grid-cols-2",
          images.length === 3 && "sm:grid-cols-3",
          images.length >= 4 && "grid-cols-2 lg:grid-cols-4",
        )}
      >
        {images.map((entry, index) => (
          <div key={index} className={cn("relative bg-cream", aspect)}>
            <Image
              src={entry.src}
              alt={entry.alt}
              fill
              sizes="(max-width: 640px) 100vw, 25vw"
              className="object-cover"
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function TextBlock({ content }: { content: Content }) {
  return (
    <section className="container-page py-16 sm:py-20">
      <div className="mx-auto max-w-2xl">
        {content.heading && (
          <h2 className="text-2xl sm:text-3xl">{content.heading}</h2>
        )}
        {content.body && (
          <p className="mt-5 whitespace-pre-line leading-relaxed text-sea-800">
            {content.body}
          </p>
        )}
        <Cta content={content} />
      </div>
    </section>
  );
}

async function ProductsBlock({ content }: { content: Content }) {
  const limit = Math.min(Math.max(Number(content.limit) || 4, 1), 12);
  const products = await getProducts(
    content.categoryId && content.categoryId !== "featured"
      ? { categoryId: content.categoryId, limit }
      : { featuredOnly: true, limit },
  );

  if (!products.length) return null;

  return (
    <section className="container-page py-16 sm:py-20">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        {content.heading && (
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-ink">
            {content.heading}
          </h2>
        )}
        {content.ctaLabel && (
          <Link
            href={content.ctaHref || "/shop"}
            className="border-b border-ink/30 pb-0.5 text-xs font-semibold uppercase tracking-[0.14em] hover:border-ink"
          >
            {content.ctaLabel}
          </Link>
        )}
      </div>

      <div className="mt-8 grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
