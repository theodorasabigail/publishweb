import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";

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

  // Points earned before this person had an account follow them in the first
  // time they arrive here. Signing in with a password never touches
  // /auth/callback, so this is the one place every signed-in customer passes
  // through. Safe to run every time: a collected bucket has nothing left in it.
  let collected = 0;
  if (isSupabaseConfigured()) {
    const { data } = await createAdminClient().rpc("claim_pending_points", {
      p_user_id: session.userId,
    });
    collected = Number(data ?? 0);
  }

  return (
    <div className="container-page py-14">
      {collected > 0 && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="font-medium text-emerald-900">
            {collected} points were waiting for you
          </p>
          <p className="mt-1 text-sm text-emerald-900">
            Earned on orders you placed before you had an account. They are on
            your balance now.
          </p>
        </div>
      )}

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
