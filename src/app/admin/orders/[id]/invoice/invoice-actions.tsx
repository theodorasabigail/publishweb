"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";

/**
 * The two buttons above the invoice. Not printed -- `@media print` hides
 * them, so what lands on paper is the invoice alone.
 */
export function InvoiceActions() {
  return (
    <div className="mb-6 flex items-center justify-between text-sm print:hidden">
      <Link
        href=".."
        className="flex items-center gap-1 text-sea-800 hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to the order
      </Link>
      <button
        type="button"
        onClick={() => window.print()}
        className="btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
      >
        <Printer className="h-3.5 w-3.5" /> Print or save as PDF
      </button>
    </div>
  );
}
