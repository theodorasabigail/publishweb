/**
 * The block vocabulary.
 *
 * This file is the contract between the admin (which writes blocks), the
 * database (which stores them as jsonb) and the renderer (which draws them).
 * Adding a block type means adding it here, to the editor's field list, and to
 * the renderer — three places, on purpose, so a type can never be half-built.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS NOT A PAGE BUILDER
 *
 * A builder that can express any layout can express a broken one. Drag-and-drop
 * canvases hand the operator a set of problems — column widths, breakpoints,
 * vertical rhythm, what happens at 320px — that are genuinely hard and that a
 * roaster should never have to think about.
 *
 * So the operator chooses *which* blocks and *in what order*. Each block is a
 * layout that has already been designed and is already correct at every width.
 * There is no arrangement available here that looks wrong, because wrong
 * arrangements are not among the options. That constraint is the feature.
 * ---------------------------------------------------------------------------
 */

export type BlockType =
  | "split"
  | "full_image"
  | "statement"
  | "products"
  | "categories"
  | "posts"
  | "features"
  | "gallery"
  | "text"
  | "rule";

export interface BlockField {
  name: string;
  label: string;
  kind:
    | "text"
    | "textarea"
    | "image"
    | "video"
    | "select"
    | "number"
    | "category";
  hint?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
}

export interface BlockDefinition {
  type: BlockType;
  label: string;
  /** What it looks like, in one line, for someone picking from a list. */
  summary: string;
  fields: BlockField[];
}

const IMAGE_SIDE: BlockField = {
  name: "side",
  label: "Picture on the",
  kind: "select",
  options: [
    { value: "left", label: "Left" },
    { value: "right", label: "Right" },
  ],
};

/**
 * The icons a "short points" block may use.
 *
 * A fixed list rather than free text: an icon name that does not resolve
 * renders as nothing, and a blank space where a picture should be is worse
 * than no picture at all.
 */
const ICON_OPTIONS = [
  { value: "", label: "No icon" },
  { value: "flame", label: "Flame" },
  { value: "package", label: "Parcel" },
  { value: "globe", label: "Globe" },
  { value: "coffee", label: "Coffee" },
  { value: "truck", label: "Delivery" },
  { value: "leaf", label: "Leaf" },
  { value: "clock", label: "Clock" },
  { value: "sparkles", label: "Sparkle" },
];

const CTA_FIELDS: BlockField[] = [
  {
    name: "ctaLabel",
    label: "Button text",
    kind: "text",
    hint: "Leave empty for no button.",
    placeholder: "Shop the roast list",
  },
  {
    name: "ctaHref",
    label: "Button link",
    kind: "text",
    placeholder: "/shop",
  },
];

export const BLOCK_DEFINITIONS: BlockDefinition[] = [
  {
    type: "split",
    label: "Picture and text",
    summary:
      "An image or silent loop filling one half, words on the other. The workhorse.",
    fields: [
      { name: "image", label: "Picture", kind: "image" },
      {
        name: "video",
        label: "Video or GIF instead",
        kind: "video",
        hint: "Plays silently on a loop. The picture above becomes its first frame, so set both.",
      },
      { name: "alt", label: "Picture description", kind: "text", hint: "For screen readers and search engines." },
      IMAGE_SIDE,
      { name: "eyebrow", label: "Small line above", kind: "text", placeholder: "New arrival" },
      { name: "heading", label: "Heading", kind: "text", placeholder: "Bring us your green beans." },
      { name: "body", label: "Paragraph", kind: "textarea" },
      ...CTA_FIELDS,
      {
        name: "tone",
        label: "Background",
        kind: "select",
        options: [
          { value: "cream", label: "Page colour" },
          { value: "white", label: "White" },
          { value: "dark", label: "Dark" },
        ],
      },
    ],
  },
  {
    type: "full_image",
    label: "Full-width picture or video",
    summary:
      "One image or silent loop, edge to edge, with optional words over it. The opening shot.",
    fields: [
      { name: "image", label: "Picture", kind: "image", hint: "Wide and high-resolution works best." },
      {
        name: "video",
        label: "Video or GIF instead",
        kind: "video",
        hint: "Plays silently on a loop. The picture above becomes its first frame, so set both.",
      },
      { name: "alt", label: "Picture description", kind: "text" },
      { name: "eyebrow", label: "Small line above", kind: "text" },
      { name: "heading", label: "Heading", kind: "text" },
      { name: "body", label: "Paragraph", kind: "textarea" },
      ...CTA_FIELDS,
      {
        name: "align",
        label: "Words sit",
        kind: "select",
        options: [
          { value: "bottom-left", label: "Bottom left" },
          { value: "bottom-right", label: "Bottom right" },
          { value: "center", label: "Centred" },
        ],
      },
      {
        name: "height",
        label: "Height",
        kind: "select",
        options: [
          { value: "short", label: "Short" },
          { value: "tall", label: "Tall" },
          { value: "full", label: "Full screen" },
        ],
      },
    ],
  },
  {
    type: "statement",
    label: "Statement",
    summary: "A short line of large type in a lot of space. Nothing else.",
    fields: [
      { name: "eyebrow", label: "Small line above", kind: "text" },
      { name: "heading", label: "The line", kind: "textarea", placeholder: "Roasted the day it ships." },
      { name: "body", label: "Paragraph underneath", kind: "textarea" },
      ...CTA_FIELDS,
    ],
  },
  {
    type: "products",
    label: "Row of coffees",
    summary: "Coffees from one category, or your featured ones.",
    fields: [
      { name: "heading", label: "Heading", kind: "text", placeholder: "On the shelf" },
      { name: "categoryId", label: "Which coffees", kind: "category" },
      { name: "limit", label: "How many", kind: "number", placeholder: "4" },
      ...CTA_FIELDS,
    ],
  },
  {
    type: "features",
    label: "Three short points",
    summary:
      "A row of two to four small promises — roasted to order, ships worldwide. Leave a title empty to show fewer.",
    fields: [
      { name: "heading", label: "Heading above", kind: "text", hint: "Optional." },
      { name: "icon1", label: "Point 1 icon", kind: "select", options: ICON_OPTIONS },
      { name: "title1", label: "Point 1 title", kind: "text", placeholder: "Roasted to order" },
      { name: "body1", label: "Point 1 text", kind: "textarea" },
      { name: "icon2", label: "Point 2 icon", kind: "select", options: ICON_OPTIONS },
      { name: "title2", label: "Point 2 title", kind: "text" },
      { name: "body2", label: "Point 2 text", kind: "textarea" },
      { name: "icon3", label: "Point 3 icon", kind: "select", options: ICON_OPTIONS },
      { name: "title3", label: "Point 3 title", kind: "text" },
      { name: "body3", label: "Point 3 text", kind: "textarea" },
      { name: "icon4", label: "Point 4 icon", kind: "select", options: ICON_OPTIONS },
      { name: "title4", label: "Point 4 title", kind: "text" },
      { name: "body4", label: "Point 4 text", kind: "textarea" },
    ],
  },
  {
    type: "categories",
    label: "Ways to browse",
    summary:
      "A grid of your categories, each with its own description and a link through.",
    fields: [
      { name: "heading", label: "Heading", kind: "text", placeholder: "Browse by style" },
      { name: "body", label: "Paragraph underneath", kind: "textarea" },
      {
        name: "linkLabel",
        label: "Link text on each card",
        kind: "text",
        placeholder: "Browse",
      },
    ],
  },
  {
    type: "posts",
    label: "Row of journal posts",
    summary: "The most recent writing, with a way through to the rest.",
    fields: [
      { name: "heading", label: "Heading", kind: "text", placeholder: "From the Journal" },
      { name: "limit", label: "How many", kind: "number", placeholder: "3" },
      ...CTA_FIELDS,
    ],
  },
  {
    type: "gallery",
    label: "Picture grid",
    summary: "Two, three or four pictures side by side, edge to edge.",
    fields: [
      { name: "heading", label: "Heading", kind: "text" },
      { name: "image1", label: "Picture 1", kind: "image" },
      { name: "image2", label: "Picture 2", kind: "image" },
      { name: "image3", label: "Picture 3", kind: "image" },
      { name: "image4", label: "Picture 4", kind: "image", hint: "Leave any empty to show fewer." },
      {
        name: "shape",
        label: "Picture shape",
        kind: "select",
        options: [
          { value: "portrait", label: "Tall" },
          { value: "square", label: "Square" },
          { value: "landscape", label: "Wide" },
        ],
      },
    ],
  },
  {
    type: "text",
    label: "Words",
    summary: "A single column of text, set at a comfortable reading width.",
    fields: [
      { name: "heading", label: "Heading", kind: "text" },
      { name: "body", label: "Text", kind: "textarea", hint: "Line breaks are kept." },
    ],
  },
  {
    type: "rule",
    label: "Divider",
    summary: "A hairline and some space, to separate what is above from below.",
    fields: [],
  },
];

export function blockDefinition(type: string): BlockDefinition | null {
  return BLOCK_DEFINITIONS.find((entry) => entry.type === type) ?? null;
}

export interface PageBlock {
  id: string;
  page: string;
  block_type: BlockType;
  sort_order: number;
  is_active: boolean;
  content: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface PageRecord {
  id: string;
  slug: string;
  title: string;
  seo_title: string | null;
  seo_description: string | null;
  is_published: boolean;
  show_in_nav: boolean;
  nav_order: number;
  /** Built-in pages answer at their own route; custom ones at /p/<slug>. */
  href: string | null;
  is_built_in: boolean;
  blocks_mode: "append" | "replace";
  /** Null means "use the wording the page ships with". */
  heading: string | null;
  intro: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * The wording each built-in page ships with.
 *
 * Every page reads its own entry and lets the database override it, so a page
 * nobody has edited looks exactly as it always did, and clearing a field in
 * the admin restores this rather than leaving a blank heading.
 */
export const BUILT_IN_COPY: Record<string, { heading: string; intro: string }> = {
  shop: {
    heading: "The roast list",
    intro:
      "Every coffee on the shelf right now, whatever it is grouped under. Roasted to order and shipped within 48 hours.",
  },
  roasting: {
    heading: "Your green beans, our drum.",
    intro:
      "We roast to order for caf\u00e9s, small brands, and anyone with a sack of green coffee and nowhere to roast it. Every job is quoted individually \u2014 volume, origin and target profile all move the number.",
  },
  about: {
    heading: "",
    intro: "",
  },
  home: {
    heading: "",
    intro: "",
  },
  blog: {
    heading: "The Journal",
    intro:
      "What we are roasting, where it came from, and what we got wrong last week. Written by the people at the drum.",
  },
};

/** Heading and intro for a built-in page, operator override winning. */
export function pageCopy(
  slug: string,
  page: PageRecord | null,
): { heading: string; intro: string } {
  const shipped = BUILT_IN_COPY[slug] ?? { heading: "", intro: "" };
  return {
    heading: page?.heading?.trim() || shipped.heading,
    intro: page?.intro?.trim() || shipped.intro,
  };
}

/** True when the operator has handed this page over to its blocks. */
export function blocksReplacePage(
  page: PageRecord | null,
  blockCount: number,
): boolean {
  // Replace mode with no blocks would render an empty page, which is never
  // what someone meant — so it only takes effect once there is something to
  // put there.
  return page?.blocks_mode === "replace" && blockCount > 0;
}

/**
 * Pages that offer the one-press "rebuild from blocks" button.
 *
 * Lives here rather than beside the starter blocks themselves, because a
 * "use server" module may only export async functions -- a plain constant
 * there fails the build.
 */
export const CONVERTIBLE_PAGES = ["home"];

/**
 * Pages that exist in code as well as in the database.
 *
 * Listed here so the admin still works before 0018 has been run, and so a page
 * can never be deleted out of existence while its route keeps answering.
 */
export const BUILT_IN_PAGES = [
  { slug: "home", title: "Home", href: "/" },
  { slug: "shop", title: "Shop", href: "/shop" },
  { slug: "roasting", title: "Jasa Roasting", href: "/roasting" },
  { slug: "blog", title: "Journal", href: "/blog" },
  { slug: "about", title: "About", href: "/about" },
];

/**
 * A block with nothing in it renders as empty space the operator cannot see
 * the cause of, so the renderer skips it. This decides what "nothing in it"
 * means per type.
 */
export function isBlockEmpty(block: PageBlock): boolean {
  const c = block.content ?? {};
  switch (block.block_type) {
    case "rule":
      return false;
    case "full_image":
      return !c.image && !c.video && !c.heading;
    case "gallery":
      return !c.image1 && !c.heading;
    case "products":
    case "categories":
    case "posts":
      return false;
    case "features":
      return !c.title1 && !c.title2 && !c.title3 && !c.title4 && !c.heading;
    default:
      return !c.heading && !c.body && !c.image && !c.video;
  }
}
