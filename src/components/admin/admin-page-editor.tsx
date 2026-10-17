"use client";

import { useRouter } from "next/navigation";
import { pageEditorData, type EditorData } from "@/app/admin/_actions/page-editor";
import { PageEditor } from "@/components/admin/page-editor";

/** The page editor inside Admin → Pages, refreshing the admin view as it saves. */
export function AdminPageEditor({ initial }: { initial: EditorData }) {
  const router = useRouter();
  return (
    <PageEditor
      initial={initial}
      load={() => pageEditorData(initial.slug)}
      onChanged={() => router.refresh()}
    />
  );
}
