import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { PrelaunchBanner } from "@/components/admin/prelaunch-banner";
import { SchemaCheck } from "@/components/admin/schema-check";
import { adminFont } from "@/lib/fonts";
import { requireAdmin } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Reaching the dashboard before Supabase is connected should explain itself
  // rather than redirect into a login that cannot work yet.
  if (!isSupabaseConfigured()) return <NotConnectedYet />;

  const session = await requireAdmin();

  return (
    // `admin-ui` is what switches on the dashboard's own type scale and
    // interface font; see the block at the end of globals.css.
    <div className={`admin-ui min-h-screen bg-sea-50 ${adminFont.variable}`}>
      <div className="mx-auto flex w-full max-w-[1400px] flex-col lg:flex-row">
        <aside className="shrink-0 border-b border-sea-200 bg-white lg:min-h-screen lg:w-64 lg:border-b-0 lg:border-r">
          <div className="px-5 py-5">
            <Link href="/" className="font-serif text-base font-semibold">
              Publish <span className="text-sea-800">Coffee Roasters</span>
            </Link>
            <p className="mt-0.5 text-xs text-sea-800">Admin dashboard</p>
          </div>

          <AdminNav />

          <div className="hidden border-t border-sea-200 px-5 py-4 lg:block">
            <p className="truncate text-xs text-sea-800">{session.email}</p>
            <div className="mt-2 flex flex-col gap-1.5 text-xs">
              <Link href="/" className="text-sea-700 hover:underline">
                View the shop →
              </Link>
              <form action="/auth/logout" method="post">
                <button type="submit" className="text-sea-700 hover:underline">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 p-5 sm:p-8">
          <SchemaCheck />
          <PrelaunchBanner />
          {children}
        </main>
      </div>
    </div>
  );
}

function NotConnectedYet() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-sea-50 px-6">
      <div className="card max-w-lg p-8">
        <h1 className="text-2xl">Connect Supabase first</h1>
        <p className="mt-3 text-sm text-sea-800">
          The dashboard needs a database before it can show you anything. Add
          these in Vercel → Settings → Environment Variables, then redeploy:
        </p>
        <ul className="mt-4 space-y-1.5 font-mono text-sm text-sea-800">
          <li>NEXT_PUBLIC_SUPABASE_URL</li>
          <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
          <li>SUPABASE_SERVICE_ROLE_KEY</li>
        </ul>
        <p className="mt-4 text-sm text-sea-800">
          Step 1 of{" "}
          <code className="rounded bg-sea-100 px-1.5 py-0.5">
            docs/OPERATOR_SETUP.md
          </code>{" "}
          walks through where to find each one.
        </p>
      </div>
    </div>
  );
}
