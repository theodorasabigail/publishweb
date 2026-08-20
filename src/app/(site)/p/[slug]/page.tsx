import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageBlocks } from "@/components/blocks/page-blocks";
import { getPageBlocks, getPageBySlug } from "@/lib/queries";

/*
 * Same reasoning as the shop: the admin revalidates on every save, so this
 * timer only catches changes made outside it. Set long, because each expiry
 * costs a fresh set of queries.
 */
export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPageBySlug(slug);
  if (!page) return {};

  return {
    title: page.seo_title ?? page.title,
    description: page.seo_description ?? undefined,
    alternates: { canonical: `/p/${slug}` },
  };
}

/**
 * A page the operator built out of blocks.
 *
 * There is deliberately no chrome here — no heading, no breadcrumb, no
 * container. The blocks are the page. A built-in title above them would fight
 * whatever the first block is, and the first block is nearly always a
 * full-width image that wants to start at the top of the screen.
 */
export default async function CustomPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await getPageBySlug(slug);
  if (!page) notFound();

  const blocks = await getPageBlocks(slug);
  if (!blocks.length) notFound();

  return <PageBlocks blocks={blocks} />;
}
