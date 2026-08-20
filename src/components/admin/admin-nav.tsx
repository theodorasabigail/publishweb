"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Coffee,
  CreditCard,
  Flame,
  LayoutDashboard,
  Settings,
  ShoppingCart,
  Store,
  Tags,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The dashboard sidebar.
 *
 * A client component only because knowing which page you are on requires the
 * current path. Without a highlighted item every screen looks the same as
 * every other, which is the single most disorienting thing about a dashboard
 * — and on mobile, where the nav is a horizontal scroller, it is the only cue
 * that scrolling sideways would reveal more.
 *
 * The list lives here rather than being passed in from the layout, and it has
 * to: an icon is a React component, which is a function, and functions cannot
 * cross the server-to-client boundary. Passing them in built cleanly and then
 * failed on every request, because /admin is rendered on demand and never
 * prerendered — so nothing evaluated the boundary until a real visitor did.
 */
const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/pos", label: "Counter sales", icon: Store },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { href: "/admin/reports", label: "Sales", icon: BarChart3 },
  { href: "/admin/products", label: "Products", icon: Coffee },
  { href: "/admin/categories", label: "Categories", icon: Tags },
  { href: "/admin/roasting", label: "Roasting requests", icon: Flame },
  { href: "/admin/blog", label: "Journal", icon: BookOpen },
  { href: "/admin/customers", label: "Customers & loyalty", icon: Users },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/settings", label: "Site settings", icon: Settings },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible">
      {NAV.map((item) => {
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
