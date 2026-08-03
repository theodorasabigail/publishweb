import { Star, Trash2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Address } from "@/lib/types";
import { deleteAddress, makeDefaultAddress, saveAddress } from "./actions";

export const dynamic = "force-dynamic";

export default async function AddressesPage() {
  const session = await requireUser("/account/addresses");
  const supabase = await createClient();

  const { data } = await supabase
    .from("addresses")
    .select("*")
    .eq("user_id", session.userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  const addresses = (data ?? []) as Address[];

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_420px]">
      <div>
        <h2 className="text-xl">Saved addresses</h2>

        {addresses.length ? (
          <ul className="mt-4 space-y-3">
            {addresses.map((address) => (
              <li key={address.id} className="card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">
                      {address.recipient_name}
                      {address.is_default && (
                        <span className="badge ml-2 bg-bark-100 text-bark-700">
                          Default
                        </span>
                      )}
                    </p>
                    <address className="mt-1.5 text-sm not-italic leading-relaxed text-bark-600">
                      {address.line1}
                      {address.line2 && <>, {address.line2}</>}
                      <br />
                      {address.city}
                      {address.province && `, ${address.province}`}{" "}
                      {address.postal_code}
                      <br />
                      {address.country} · {address.phone}
                    </address>
                  </div>

                  <div className="flex shrink-0 gap-1">
                    {!address.is_default && (
                      <form action={makeDefaultAddress}>
                        <input type="hidden" name="id" value={address.id} />
                        <button
                          type="submit"
                          className="rounded-lg p-2 text-bark-500 hover:bg-bark-100"
                          title="Make default"
                        >
                          <Star className="h-4 w-4" />
                        </button>
                      </form>
                    )}
                    <form action={deleteAddress}>
                      <input type="hidden" name="id" value={address.id} />
                      <button
                        type="submit"
                        className="rounded-lg p-2 text-bark-500 hover:bg-red-50 hover:text-red-700"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 card p-6 text-sm text-bark-600">
            No saved addresses yet. Add one and checkout gets a lot faster.
          </p>
        )}
      </div>

      <div className="card h-fit p-6">
        <h2 className="text-xl">Add an address</h2>
        <form action={saveAddress} className="mt-5 space-y-4">
          <div>
            <label className="label" htmlFor="recipient_name">Recipient name *</label>
            <input id="recipient_name" name="recipient_name" className="input" required />
          </div>
          <div>
            <label className="label" htmlFor="phone">Phone *</label>
            <input id="phone" name="phone" className="input" required />
          </div>
          <div>
            <label className="label" htmlFor="line1">Address *</label>
            <input id="line1" name="line1" className="input" required />
          </div>
          <div>
            <label className="label" htmlFor="line2">Apartment, unit (optional)</label>
            <input id="line2" name="line2" className="input" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="city">City *</label>
              <input id="city" name="city" className="input" required />
            </div>
            <div>
              <label className="label" htmlFor="province">Province / state</label>
              <input id="province" name="province" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="postal_code">Postal code</label>
              <input id="postal_code" name="postal_code" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="country">Country code *</label>
              <input
                id="country"
                name="country"
                className="input"
                defaultValue="ID"
                maxLength={2}
                required
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-bark-700">
            <input type="checkbox" name="is_default" className="rounded border-bark-300" />
            Make this my default address
          </label>

          <button type="submit" className="btn-primary w-full">
            Save address
          </button>
        </form>
      </div>
    </div>
  );
}
