import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="container-page max-w-md py-20">
      <h1 className="text-4xl">Sign in</h1>
      <p className="mt-2 text-sea-800">
        Your orders, addresses and loyalty points live here.
      </p>
      <div className="card mt-8 p-6 sm:p-8">
        <AuthForm mode="login" next={safeNext(next)} />
      </div>
    </div>
  );
}

/** Only ever redirect within this site. */
function safeNext(next: string | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/account";
  return next;
}
