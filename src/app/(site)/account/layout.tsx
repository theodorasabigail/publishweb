import Link from "next/link";
import { requireUser } from "@/lib/auth";

const TABS = [
  { href: "/account", label: "Overview" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/addresses", label: "Addresses" },
];

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireUser();

  return (
    <div className="container-page py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">
            {session.profile?.display_name
              ? `Hello, ${session.profile.display_name}`
              : "Your account"}
          </h1>
          <p className="mt-2 text-sm text-sea-800">{session.email}</p>
        </div>

        <div className="flex items-center gap-3">
          {session.profile?.is_admin && (
            <Link href="/admin" className="btn-secondary">
              Admin dashboard
            </Link>
          )}
          <form action="/auth/logout" method="post">
            <button type="submit" className="btn-ghost">
              Sign out
            </button>
          </form>
        </div>
      </div>

      <nav className="mt-8 flex gap-2 border-b border-sea-200/70">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="-mb-px border-b-2 border-transparent px-3 py-2.5 text-sm text-sea-700 hover:border-sea-300"
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <div className="mt-8">{children}</div>
    </div>
  );
}
