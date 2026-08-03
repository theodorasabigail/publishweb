import { env } from "@/lib/env";
import { manualTransferProvider } from "./manual-transfer";
import type { PaymentProvider } from "./types";
import { xenditProvider } from "./xendit";

export * from "./types";
export { xenditProvider } from "./xendit";
export { manualTransferProvider, manualTransferDetails } from "./manual-transfer";

const providers: Record<string, PaymentProvider> = {
  xendit: xenditProvider,
  manual_transfer: manualTransferProvider,
};

/**
 * The active payment provider, chosen by the PAYMENT_PROVIDER environment
 * variable. Defaults to Xendit, which is the spec's recommended path and the
 * only one that serves foreign customers.
 */
export function getPaymentProvider(): PaymentProvider {
  const id = (env.optional("PAYMENT_PROVIDER") ?? "xendit").toLowerCase();
  const provider = providers[id];
  if (!provider) {
    throw new Error(
      `Unknown PAYMENT_PROVIDER "${id}". Set it to "xendit" or "manual_transfer".`,
    );
  }
  return provider;
}

export function getProviderById(id: string): PaymentProvider | null {
  return providers[id] ?? null;
}
