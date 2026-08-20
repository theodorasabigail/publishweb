"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * The dashboard sidebar.
 *
 * A client component only because knowing which page you are on requires the
 * current path. Without a highlighted item every screen looks the same as
 * every other, which is the single most disorienting thing about a dashboard
 * — and on mobile, where the nav is a horizontal scroller, it is the only cue
 * that scrolling sideways would reveal more.
 */
export function AdminNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible">
      {items.map((item) => {
        // /admin matches only itself; everything else also owns its subpages,
        // so /admin/settings/email keeps "Site settings" lit.
        const active =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
              active
                ? "bg-bark-800 font-medium text-cream"
                : "text-bark-700 hover:bg-bark-100",
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="whitespace-nowrap">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
