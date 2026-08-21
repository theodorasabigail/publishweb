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

/**
 * The operator's own pages sit after the fixed ones rather than among them.
 *
 * They are passed in from the layout, which reads them once per render pass,
 * because this is a client component and a database call cannot happen here.
 */
export function SiteHeader({
  extraNav = [],
}: {
  extraNav?: { href: string; label: string }[];
}) {
  const nav = [...NAV, ...extraNav];
  const pathname = usePathname();
  const { count, ready } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-sea-200/70 bg-cream/90 backdrop-blur">
      {/* A thin bar of small capitals. The nav is the quietest type on the
          page on purpose: the wider the gap between it and a page title, the
          more the title reads as deliberate rather than just large. */}
      <div className="container-page flex h-14 items-center justify-between gap-6">
        <Link href="/" className="microcaps shrink-0 text-ink">
          Publish<span className="text-sea-800"> Coffee Roasters</span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                // Underline, not a filled pill. The bar stays a line of text.
                "microcaps border-b-2 pb-0.5 transition-colors",
                pathname.startsWith(item.href)
                  ? "border-ink text-ink"
                  : "border-transparent text-sea-800 hover:text-ink",
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
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center bg-ink px-1 text-[10px] font-semibold text-cream">
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
        <nav className="border-t border-sea-200/70 bg-cream md:hidden">
          <div className="container-page flex flex-col py-2">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-2 py-3 text-sm text-sea-800 hover:bg-sea-100"
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
