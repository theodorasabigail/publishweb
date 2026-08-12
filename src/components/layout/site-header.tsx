"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, ShoppingBag, X } from "lucide-react";
import { AccountLink } from "@/components/layout/account-link";
import { useCart } from "@/components/cart-provider";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/shop", label: "Shop" },
  { href: "/roasting", label: "Jasa Roasting" },
  { href: "/blog", label: "Journal" },
  { href: "/about", label: "About" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { count, ready } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-bark-200/70 bg-cream/90 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" className="font-serif text-lg font-semibold tracking-tight">
          Publish<span className="text-bark-500"> Coffee Roasters</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm transition-colors hover:bg-bark-100",
                pathname.startsWith(item.href)
                  ? "bg-bark-100 font-medium text-bark-900"
                  : "text-bark-700",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <AccountLink />

          <Link href="/cart" className="btn-ghost relative px-3" aria-label="Cart">
            <ShoppingBag className="h-4 w-4" />
            {ready && count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-bark-800 px-1 text-[11px] font-semibold text-cream">
                {count}
              </span>
            )}
          </Link>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="btn-ghost px-3 md:hidden"
            aria-label="Menu"
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="border-t border-bark-200/70 bg-cream md:hidden">
          <div className="container-page flex flex-col py-2">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-2 py-3 text-sm text-bark-800 hover:bg-bark-100"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
