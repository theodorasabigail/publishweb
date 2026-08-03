import { PageHeader } from "@/components/admin/ui";
import { PostForm } from "@/components/admin/post-form";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BlogCategory } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function NewPostPage() {
  const supabase = createAdminClient();
  const { data } = await supabase.from("blog_categories").select("*").order("sort_order");

  return (
    <div>
      <PageHeader title="New post" description="Save it as a draft until it is ready." />
      <PostForm categories={(data ?? []) as BlogCategory[]} />
    </div>
  );
}
