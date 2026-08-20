import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = {
  title: "Create an account",
  robots: { index: false, follow: false },
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const target = !next || !next.startsWith("/") || next.startsWith("//") ? "/account" : next;

  return (
    <div className="container-page max-w-md py-20">
      <h1 className="text-4xl">Create an account</h1>
      <p className="mt-2 text-sea-800">
        Keep your order history, save addresses, and start earning points on
        every paid order.
      </p>
      <div className="card mt-8 p-6 sm:p-8">
        <AuthForm mode="signup" next={target} />
      </div>
    </div>
  );
}
