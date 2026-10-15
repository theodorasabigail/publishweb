import Link from "next/link";
import { cn } from "@/lib/utils";

/** List or sheet: two views of the same coffees, one tap apart. */
export function ProductsViewSwitch({ current }: { current: "list" | "sheet" }) {
  return (
    <nav className="mb-5 inline-flex rounded-full border border-sea-200 bg-white p-1 text-sm">
      {(
        [
          ["sheet", "Sheet", "/admin/products/sheet"],
          ["list", "List", "/admin/products"],
        ] as const
      ).map(([value, label, href]) => (
        <Link
          key={value}
          href={href}
          className={cn(
            "rounded-full px-4 py-1.5 transition-colors",
            current === value ? "bg-sea-800 text-cream" : "text-sea-800 hover:bg-sea-50",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
