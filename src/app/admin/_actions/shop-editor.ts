"use server";

import { getSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sortVariants } from "@/lib/product";
import type { ProductWithVariants } from "@/lib/types";

/**
 * What the shop's edit panel needs, for admins only.
 *
 * The storefront is rendered without reading the session (so it can be
 * cached), which means it cannot know who is looking. The edit panel asks
 * here after the page has loaded. Anyone who is not an admin gets nothing
 * back -- not an error -- so the shop looks exactly the same to them.
 */
export async function shopEditorFor(
  slug: string | null,
): Promise<{ admin: boolean; product: ProductWithVariants | null }> {
  const session = await getSession().catch(() => null);
  if (!session?.profile?.is_admin) return { admin: false, product: null };
  if (!slug) return { admin: true, product: null };

  const { data } = await createAdminClient()
    .from("products")
    .select("*, product_variants (*)")
    .eq("slug", slug)
    .maybeSingle();

  const product = data ? sortVariants([data as ProductWithVariants])[0] : null;
  return { admin: true, product };
}
