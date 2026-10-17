"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import {
  BUILT_IN_COPY,
  BUILT_IN_PAGES,
  blockDefinition,
  type PageBlock,
  type PageRecord,
} from "@/lib/blocks";
import { copySlotsFor, type CopySlot } from "@/lib/page-text";
import { getSiteSettings } from "@/lib/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminClient, describeDbError } from "./guard";

/**
 * The page editor's reads and writes.
 *
 * One field at a time, saved the moment it changes, the way the products sheet
 * works: no Save buttons, nothing to lose by navigating away. Used by the
 * "Edit this page" panel on the site itself and by Admin → Pages, which show
 * the same editor.
 *
 * A page is a list of sections. Built-in pages (shop, roasting, journal,
 * about) also have their own fixed part -- the coffee list, the quote form --
 * which appears in that list as one section that cannot be moved or removed,
 * with its wording editable. Sections the operator adds sit below it.
 */

type Result = { ok: true } | { ok: false; error: string };

const ROUTES: Record<string, string> = {
  home: "/",
  shop: "/shop",
  roasting: "/roasting",
  blog: "/blog",
  about: "/about",
};

function revalidatePage(slug: string) {
  revalidatePath(ROUTES[slug] ?? `/p/${slug}`);
  revalidatePath("/admin/pages");
  revalidatePath(`/admin/pages/${slug}`);
}

/** The fixed part of each built-in page, as it is described in the editor. */
const CORE: Record<string, { label: string; description: string }> = {
  shop: {
    label: "The coffee list",
    description: "Every coffee on the shop, with its filters. The coffees themselves come from Products.",
  },
  roasting: {
    label: "How it works and the quote form",
    description: "The steps and the quote form. Every word of it is editable here.",
  },
  blog: {
    label: "Journal posts",
    description: "Your published posts, newest first. Write them under Journal.",
  },
  about: {
    label: "About text",
    description:
      "This text is written into the site itself, so it cannot be changed here yet. Sections you add appear below it.",
  },
};

/** Marks the sections the homepage setup created, so it can be undone. */
const SETUP_MARK = "_setup";

export interface EditorSection {
  id: string;
  type: string;
  visible: boolean;
  content: Record<string, string>;
}

export interface EditorData {
  slug: string;
  href: string;
  title: string;
  isBuiltIn: boolean;
  /** The homepage before its one-time setup into sections. */
  needsSetup: boolean;
  /** The homepage after setup, while it can still be undone. */
  canUndoSetup: boolean;
  page: {
    title: string;
    showInNav: boolean;
    isPublished: boolean;
    seoTitle: string;
    seoDescription: string;
    heading: string;
    intro: string;
    copy: Record<string, string>;
  } | null;
  /** The built-in page's own fixed section, when it has one. */
  core: {
    label: string;
    description: string;
    /** Heading and intro as shipped, when the page has them. */
    shipped: { heading: string; intro: string } | null;
    slots: CopySlot[];
  } | null;
  sections: EditorSection[];
  categories: { id: string; name: string }[];
}

/** Everything the editor needs for one page; null for anyone not an admin. */
export async function pageEditorData(slug: string): Promise<EditorData | null> {
  const session = await getSession().catch(() => null);
  if (!session?.profile?.is_admin) return null;

  const supabase = createAdminClient();
  const builtIn = BUILT_IN_PAGES.find((page) => page.slug === slug);
  const [{ data: blockRows }, { data: pageRow }, { data: categoryRows }] = await Promise.all([
    supabase.from("page_blocks").select("*").eq("page", slug).order("sort_order"),
    supabase.from("pages").select("*").eq("slug", slug).maybeSingle(),
    supabase.from("categories").select("id, name").order("sort_order"),
  ]);

  const record = pageRow as PageRecord | null;
  if (!builtIn && !record) return null;

  const blocks = (blockRows ?? []) as PageBlock[];
  const replacing = record?.blocks_mode === "replace" && blocks.length > 0;
  const shipped = BUILT_IN_COPY[slug];

  return {
    slug,
    href: record?.href ?? builtIn?.href ?? `/p/${slug}`,
    title: record?.title ?? builtIn?.title ?? slug,
    isBuiltIn: Boolean(builtIn),
    needsSetup: slug === "home" && !replacing,
    canUndoSetup: slug === "home" && replacing && blocks.some((block) => block.content?.[SETUP_MARK]),
    page: record
      ? {
          title: record.title,
          showInNav: record.show_in_nav,
          isPublished: record.is_published,
          seoTitle: record.seo_title ?? "",
          seoDescription: record.seo_description ?? "",
          heading: record.heading ?? "",
          intro: record.intro ?? "",
          copy: record.copy ?? {},
        }
      : null,
    core:
      builtIn && slug !== "home" && !replacing && CORE[slug]
        ? {
            ...CORE[slug],
            shipped: shipped?.heading ? shipped : null,
            slots: copySlotsFor(slug),
          }
        : null,
    sections: blocks.map((block) => ({
      id: block.id,
      type: block.block_type,
      visible: block.is_active,
      content: block.content ?? {},
    })),
    categories: (categoryRows ?? []) as { id: string; name: string }[],
  };
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

async function sectionRow(id: string) {
  const { supabase } = await adminClient();
  const { data } = await supabase.from("page_blocks").select("*").eq("id", id).maybeSingle();
  return { supabase, block: data as PageBlock | null };
}

/** One field of one section. Only fields that section type declares. */
export async function setSectionField(id: string, field: string, value: string): Promise<Result> {
  const { supabase, block } = await sectionRow(id);
  if (!block) return { ok: false, error: "That section no longer exists." };
  const definition = blockDefinition(block.block_type);
  if (!definition?.fields.some((item) => item.name === field)) {
    return { ok: false, error: "That cannot be changed here." };
  }

  const content = { ...(block.content ?? {}) };
  const trimmed = value.trim();
  if (trimmed) content[field] = trimmed;
  else delete content[field];

  const { error } = await supabase
    .from("page_blocks")
    .update({ content, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: describeDbError(error, "Could not save that.") };
  revalidatePage(block.page);
  return { ok: true };
}

export async function setSectionVisible(id: string, visible: boolean): Promise<Result> {
  const { supabase, block } = await sectionRow(id);
  if (!block) return { ok: false, error: "That section no longer exists." };
  const { error } = await supabase
    .from("page_blocks")
    .update({ is_active: visible, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: describeDbError(error, "Could not save that.") };
  revalidatePage(block.page);
  return { ok: true };
}

/** Swap with the section above (-1) or below (1). */
export async function moveSection(id: string, direction: -1 | 1): Promise<Result> {
  const { supabase, block } = await sectionRow(id);
  if (!block) return { ok: false, error: "That section no longer exists." };

  const { data } = await supabase
    .from("page_blocks")
    .select("id, sort_order")
    .eq("page", block.page)
    .order("sort_order");
  const rows = (data ?? []) as { id: string }[];
  const index = rows.findIndex((row) => row.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= rows.length) return { ok: true };

  const reordered = [...rows];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
  // Every position rewritten, so gaps or duplicates from older data get mended.
  await Promise.all(
    reordered.map((row, position) =>
      supabase.from("page_blocks").update({ sort_order: position }).eq("id", row.id),
    ),
  );
  revalidatePage(block.page);
  return { ok: true };
}

export async function removeSection(id: string): Promise<Result> {
  const { supabase, block } = await sectionRow(id);
  if (!block) return { ok: true };
  const { error } = await supabase.from("page_blocks").delete().eq("id", id);
  if (error) return { ok: false, error: describeDbError(error, "Could not remove that.") };
  revalidatePage(block.page);
  return { ok: true };
}

/**
 * A new section at the bottom of the page, switched on. An empty section is
 * not drawn on the site, so it appears as soon as something is typed into it.
 */
export async function addSection(
  slug: string,
  type: string,
): Promise<{ ok: true; section: EditorSection } | { ok: false; error: string }> {
  const { supabase } = await adminClient();
  const definition = blockDefinition(type);
  if (!definition || definition.retired) return { ok: false, error: "Unknown kind of section." };

  const { data: last } = await supabase
    .from("page_blocks")
    .select("sort_order")
    .eq("page", slug)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("page_blocks")
    .insert({
      page: slug,
      block_type: type,
      sort_order: ((last as { sort_order: number } | null)?.sort_order ?? -1) + 1,
      is_active: true,
      content: {},
    })
    .select("*")
    .single();
  if (error || !data) return { ok: false, error: describeDbError(error, "Could not add that section.") };

  revalidatePage(slug);
  const block = data as PageBlock;
  return { ok: true, section: { id: block.id, type: block.block_type, visible: true, content: {} } };
}

// ---------------------------------------------------------------------------
// The page itself
// ---------------------------------------------------------------------------

const PAGE_TEXT = { title: "title", seoTitle: "seo_title", seoDescription: "seo_description", heading: "heading", intro: "intro" } as const;
const PAGE_FLAGS = { showInNav: "show_in_nav", isPublished: "is_published" } as const;

export async function setPageSetting(
  slug: string,
  field: keyof typeof PAGE_TEXT | keyof typeof PAGE_FLAGS,
  value: string | boolean,
): Promise<Result> {
  const { supabase } = await adminClient();
  let patch: Record<string, string | boolean | null>;

  if (field in PAGE_TEXT) {
    const text = String(value ?? "").trim();
    if (field === "title" && !text) return { ok: false, error: "A page needs a name." };
    patch = { [PAGE_TEXT[field as keyof typeof PAGE_TEXT]]: text || null };
  } else if (field in PAGE_FLAGS) {
    // A built-in page is a route in the code; it cannot be unpublished.
    if (field === "isPublished" && slug in ROUTES) {
      return { ok: false, error: "This page is part of the site and is always published." };
    }
    patch = { [PAGE_FLAGS[field as keyof typeof PAGE_FLAGS]]: value === true };
  } else {
    return { ok: false, error: "That cannot be changed here." };
  }

  const { error } = await supabase
    .from("pages")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("slug", slug);
  if (error) return { ok: false, error: describeDbError(error, "Could not save that.") };

  revalidatePath("/", "layout");
  revalidatePage(slug);
  return { ok: true };
}

/** One piece of a built-in page's wording. Empty goes back to the original. */
export async function setPageWording(slug: string, key: string, value: string): Promise<Result> {
  const { supabase } = await adminClient();
  const slot = copySlotsFor(slug).find((item) => item.key === key);
  if (!slot) return { ok: false, error: "That cannot be changed here." };

  const { data } = await supabase.from("pages").select("copy").eq("slug", slug).maybeSingle();
  const copy = { ...(((data as { copy: Record<string, string> | null } | null)?.copy) ?? {}) };
  const text = value.trim();
  // The shipped wording is not an override; storing it would freeze the page.
  if (text && text !== slot.value.trim()) copy[key] = text;
  else delete copy[key];

  const { error } = await supabase
    .from("pages")
    .update({ copy, updated_at: new Date().toISOString() })
    .eq("slug", slug);
  if (error) return { ok: false, error: describeDbError(error, "Could not save that.") };
  revalidatePage(slug);
  return { ok: true };
}

/** Move a page up or down the top menu. */
export async function movePageInMenu(slug: string, direction: -1 | 1): Promise<Result> {
  const { supabase } = await adminClient();
  const { data } = await supabase
    .from("pages")
    .select("slug, nav_order")
    .eq("show_in_nav", true)
    .order("nav_order");
  const rows = (data ?? []) as { slug: string }[];
  const index = rows.findIndex((row) => row.slug === slug);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= rows.length) return { ok: true };

  const reordered = [...rows];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
  await Promise.all(
    reordered.map((row, position) =>
      supabase.from("pages").update({ nav_order: (position + 1) * 10 }).eq("slug", row.slug),
    ),
  );
  revalidatePath("/", "layout");
  revalidatePath("/admin/pages");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// The homepage, once
// ---------------------------------------------------------------------------

/**
 * Turn the homepage into sections, once, on the operator's say-so.
 *
 * The homepage used to be drawn partly from Site settings (the big picture,
 * the categories), partly written into the code, and partly from sections.
 * This copies all of it into sections -- the picture and words from settings,
 * the categories chosen there, the exact wording of the rest -- so from now on
 * everything on the homepage is edited on the homepage.
 *
 * Nothing is deleted: Site settings keep their values, and sections already
 * added stay, after the new ones. Undo removes only what this created.
 */
export async function setUpHomepage(): Promise<Result> {
  const { supabase } = await adminClient();
  const settings = await getSiteSettings(supabase);

  const { data: existing } = await supabase
    .from("page_blocks")
    .select("id, sort_order, content")
    .eq("page", "home")
    .order("sort_order");
  const kept = (existing ?? []) as { id: string; content: Record<string, string> | null }[];
  if (kept.some((block) => block.content?.[SETUP_MARK])) {
    return { ok: false, error: "The homepage is already set up." };
  }

  const categoryIds = settings.homepage_category_ids?.length
    ? settings.homepage_category_ids
    : ((
        await supabase.from("categories").select("id").eq("show_on_homepage", true).order("sort_order")
      ).data ?? []).map((row) => (row as { id: string }).id);

  const starter: { type: string; content: Record<string, string> }[] = [
    {
      type: "hero",
      content: {
        image: settings.hero_image ?? "",
        eyebrow: "PT Aroma Pulau Arunika",
        heading: settings.hero_title ?? "",
        body: settings.hero_subtitle ?? "",
        ctaLabel: settings.hero_cta_label ?? "Shop the roast list",
        ctaHref: settings.hero_cta_href ?? "/shop",
        cta2Label: "Custom roasting",
        cta2Href: "/roasting",
      },
    },
    {
      type: "features",
      content: {
        icon1: "flame",
        title1: "Roasted to order",
        body1: "Bags go out within 48 hours of coming off the drum.",
        icon2: "package",
        title2: "Three sizes",
        body2: "100g to try, 200g for the week, 1kg for the café.",
        icon3: "globe",
        title3: "Ships worldwide",
        body3: "Flat-rate international zones, no surprise fees at checkout.",
      },
    },
    {
      type: "products",
      content: { heading: "On the shelf", categoryId: "featured", limit: "4", ctaLabel: "All coffee", ctaHref: "/shop" },
    },
    {
      type: "categories",
      content: { heading: "Browse by style", linkLabel: "Browse", categoryIds: categoryIds.join(",") },
    },
    {
      type: "split",
      content: {
        tone: "dark",
        side: "right",
        eyebrow: "Jasa Roasting",
        heading: "Bring us your green beans.",
        body: "We roast to order for cafés, small brands, and anyone with a sack of green coffee and no drum. Tell us the origin, the volume, and the roast level you are after, and we will come back with a quote.",
        ctaLabel: "Request a quote",
        ctaHref: "/roasting",
      },
    },
    {
      type: "posts",
      content: { heading: "From the Journal", limit: "3", ctaLabel: "Read all", ctaHref: "/blog" },
    },
  ];

  const { error } = await supabase.from("page_blocks").insert(
    starter.map((block, index) => ({
      page: "home",
      block_type: block.type,
      sort_order: index,
      is_active: true,
      content: Object.fromEntries(
        Object.entries({ ...block.content, [SETUP_MARK]: "1" }).filter(([, value]) => value !== ""),
      ),
    })),
  );
  if (error) return { ok: false, error: describeDbError(error, "Could not set up the homepage.") };

  // Sections that were already there go after the new ones, in their order.
  await Promise.all(
    kept.map((block, index) =>
      supabase.from("page_blocks").update({ sort_order: starter.length + index }).eq("id", block.id),
    ),
  );

  const { error: pageError } = await supabase
    .from("pages")
    .update({ blocks_mode: "replace", updated_at: new Date().toISOString() })
    .eq("slug", "home");
  if (pageError) return { ok: false, error: describeDbError(pageError, "Could not switch the homepage over.") };

  revalidatePath("/", "layout");
  revalidatePage("home");
  return { ok: true };
}

/** Put the old homepage back: remove what setup created, keep everything else. */
export async function undoHomepageSetup(): Promise<Result> {
  const { supabase } = await adminClient();
  const { data } = await supabase.from("page_blocks").select("id, content").eq("page", "home");
  const created = ((data ?? []) as { id: string; content: Record<string, string> | null }[])
    .filter((block) => block.content?.[SETUP_MARK])
    .map((block) => block.id);

  if (created.length) {
    const { error } = await supabase.from("page_blocks").delete().in("id", created);
    if (error) return { ok: false, error: describeDbError(error, "Could not undo that.") };
  }
  await supabase
    .from("pages")
    .update({ blocks_mode: "append", updated_at: new Date().toISOString() })
    .eq("slug", "home");

  revalidatePath("/", "layout");
  revalidatePage("home");
  return { ok: true };
}
