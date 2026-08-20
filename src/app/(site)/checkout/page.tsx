import type { Metadata } from "next";
import { CheckoutForm } from "@/components/shop/checkout-form";
import { getSession } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { getPaymentProvider } from "@/lib/payments";
import { createClient } from "@/lib/supabase/server";
import type { Address } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="container-page py-20">
        <p className="text-sea-800">
          Checkout is unavailable until Supabase is connected.
        </p>
      </div>
    );
  }

  const session = await getSession();

  let addresses: Address[] = [];
  if (session) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("addresses")
      .select("*")
      .eq("user_id", session.userId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    addresses = (data ?? []) as Address[];
  }

  const provider = getPaymentProvider();

  return (
    <div className="container-page py-14">
      <h1 className="text-4xl">Checkout</h1>
      <p className="mt-2 max-w-xl text-sea-800">
        {provider.supportsInternationalCards
          ? "We accept QRIS, virtual accounts, e-wallets and international cards."
          : "Domestic bank transfer and QRIS. Paying from outside Indonesia? Message us on WhatsApp and we will arrange it."}
      </p>

      <div className="mt-10">
        <CheckoutForm
          savedAddresses={addresses}
          defaultEmail={session?.email ?? ""}
          defaultName={session?.profile?.display_name ?? ""}
          isSignedIn={Boolean(session)}
          providerIsManual={provider.isManual}
        />
      </div>
    </div>
  );
}
