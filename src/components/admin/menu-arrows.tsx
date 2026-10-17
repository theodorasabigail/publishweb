"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";
import { movePageInMenu } from "@/app/admin/_actions/page-editor";

/** Move a page one place up or down the site's top menu. */
export function MenuArrows({ slug, first, last }: { slug: string; first: boolean; last: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const move = (direction: -1 | 1) =>
    start(async () => {
      await movePageInMenu(slug, direction);
      router.refresh();
    });
  return (
    <span className="flex flex-col">
      <button
        type="button"
        onClick={() => move(-1)}
        disabled={first || pending}
        aria-label="Earlier in the menu"
        className="rounded p-0.5 text-sea-800 hover:bg-sea-100 disabled:opacity-25"
      >
        <ArrowUp className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => move(1)}
        disabled={last || pending}
        aria-label="Later in the menu"
        className="rounded p-0.5 text-sea-800 hover:bg-sea-100 disabled:opacity-25"
      >
        <ArrowDown className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}
