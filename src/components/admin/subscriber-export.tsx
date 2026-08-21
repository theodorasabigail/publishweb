"use client";

import { Download } from "lucide-react";

interface Subscriber {
  email: string;
  source: string | null;
  created_at: string;
}

/**
 * Download the mailing list as a spreadsheet file.
 *
 * Built in the browser rather than served from a route: the data is already on
 * the page, so a round trip would only re-fetch what is in front of you. It
 * also means the addresses never pass through a URL that could end up in a
 * server log.
 */
export function SubscriberExport({ subscribers }: { subscribers: Subscriber[] }) {
  function download() {
    // Quote every field and double any internal quotes — an address should
    // never be able to break the file, and neither should a source label.
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;

    const rows = [
      ["email", "source", "joined"].map(escape).join(","),
      ...subscribers.map((row) =>
        [
          escape(row.email),
          escape(row.source ?? ""),
          escape(new Date(row.created_at).toISOString().slice(0, 10)),
        ].join(","),
      ),
    ].join("\n");

    // The BOM is what makes Excel open UTF-8 correctly instead of mangling
    // any address with an accent in it.
    const blob = new Blob([`﻿${rows}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `publish-mailing-list-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={!subscribers.length}
      className="btn-secondary disabled:opacity-40"
    >
      <Download className="h-4 w-4" /> Export as CSV
    </button>
  );
}
