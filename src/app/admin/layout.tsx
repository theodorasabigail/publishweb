import Link from "next/link";
import {
  BookOpen,
  Coffee,
  CreditCard,
  Flame,
  LayoutDashboard,
  Settings,
  ShoppingCart,
  Tags,
  Users,
} from "lucide-react";
import { requireAdmin } from "@/lib/auth";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { href: "/admin/products", label: "Products", icon: Coffee },
  { href: "/admin/categories", label: "Categories", icon: Tags },
  { href: "/admin/roasting", label: "Roasting requests", icon: Flame },
  { href: "/admin/blog", label: "Journal", icon: BookOpen },
  { href: "/admin/customers", label: "Customers & loyalty", icon: Users },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/settings", label: "Site settings", icon: Settings },
];

export const metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdmin();

  return (
    <div className="min-h-screen bg-bark-50">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col lg:flex-row">
        <aside className="shrink-0 border-b border-bark-200 bg-white lg:min-h-screen lg:w-64 lg:border-b-0 lg:border-r">
          <div className="px-5 py-5">
            <Link href="/" className="font-serif text-base font-semibold">
              Publish <span className="text-bark-500">Coffee Roasters</span>
            </Link>
            <p className="mt-0.5 text-xs text-bark-500">Admin dashboard</p>
          </div>

          <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-bark-700 hover:bg-bark-100"
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="hidden border-t border-bark-200 px-5 py-4 lg:block">
            <p className="truncate text-xs text-bark-500">{session.email}</p>
            <div className="mt-2 flex flex-col gap-1.5 text-xs">
              <Link href="/" className="text-bark-700 hover:underline">
                View the shop →
              </Link>
              <form action="/auth/logout" method="post">
                <button type="submit" className="text-bark-700 hover:underline">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 p-5 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
