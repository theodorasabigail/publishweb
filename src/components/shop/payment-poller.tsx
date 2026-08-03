"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Refreshes the order page while payment is outstanding, so the customer sees
 * confirmation the moment the gateway webhook lands -- without a manual reload
 * and without us emailing "did it work?".
 */
export function PaymentPoller({ intervalMs = 12000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), intervalMs);
    return () => window.clearInterval(timer);
  }, [router, intervalMs]);

  return null;
}
