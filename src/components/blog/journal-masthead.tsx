import Link from "next/link";
import { Rss } from "lucide-react";
import type { BlogCategory } from "@/lib/types";

/**
 * The journal's masthead and section bar.
 *
 * A publication announces itself once, at the top, and then gets out of the
 * way — so the title sits on its own between two rules, and the sections run
 * beneath as letterspaced small caps rather than as pills. Pills are a control
 * you press; section names are a table of contents you read.
 */
export function JournalMasthead({
  categories,
  active,
  title = "The Journal",
  tagline,
}: {
  categories: BlogCategory[];
  /** Slug of the current section, or "all" on the index. */
  active?: string;
  title?: string;
  tagline?: string;
}) {
  return (
    <header className="border-b border-ink pb-4">
      <div className="border-b border-sea-200 pb-8 pt-4 text-center">
        <Link href="/blog" className="inline-block">
          <h1 className="text-5xl sm:text-7xl">{title}</h1>
        </Link>
        {tagline && (
          <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-sea-800">
            {tagline}
          </p>
        )}
      </div>

      <nav
        className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2"
        aria-label="Journal sections"
      >
        <SectionLink href="/blog" label="All" active={!active || active === "all"} />
        {categories.map((category) => (
          <SectionLink
            key={category.id}
            href={`/blog/category/${category.slug}`}
            label={category.name}
            active={active === category.slug}
          />
        ))}
        <a
          href="/rss.xml"
          className="kicker flex items-center gap-1.5 text-sea-800 hover:text-ink"
          title="Subscribe by RSS"
        >
          <Rss className="h-3 w-3" /> RSS
        </a>
      </nav>
    </header>
  );
}

function SectionLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      // The current section is marked by an underline rather than a filled
      // background, so the bar stays a line of text and not a row of buttons.
      className={`kicker pb-0.5 ${
        active
          ? "border-b-2 border-coral text-ink"
          : "border-b-2 border-transparent text-sea-800 hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
}
