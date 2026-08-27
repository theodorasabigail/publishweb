import Link from "next/link";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && <p className="mt-1 text-sm text-sea-800">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/**
 * A card for a distinct section of an admin page.
 *
 * `accent` colours the header strip so an operator can pick out categories at
 * a glance -- shipping (sky), money (amber), customer (emerald), danger
 * (rose). Default is unstyled, for panels that don't belong to a category.
 * `icon` renders alongside the title when the label alone doesn't earn its
 * width -- use it for repeating category headers, not one-offs.
 */
export type PanelAccent = "sky" | "amber" | "emerald" | "rose" | "sea";

const ACCENT_STYLES: Record<PanelAccent, string> = {
  sky: "bg-sky-50 text-sky-900",
  amber: "bg-amber-50 text-amber-900",
  emerald: "bg-emerald-50 text-emerald-900",
  rose: "bg-rose-50 text-rose-900",
  sea: "bg-sea-50 text-ink",
};

export function Panel({
  title,
  description,
  children,
  className,
  accent,
  icon,
  actions,
  id,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  accent?: PanelAccent;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  id?: string;
}) {
  const accentStyle = accent ? ACCENT_STYLES[accent] : "";
  return (
    <section id={id} className={cn("scroll-mt-6 rounded-xl border border-sea-200 bg-white", className)}>
      {(title || description) && (
        <div
          className={cn(
            "flex flex-wrap items-start justify-between gap-3 border-b border-sea-200 px-5 py-4",
            accentStyle,
          )}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {icon}
              {title && <h2 className="font-medium">{title}</h2>}
            </div>
            {description && (
              <p
                className={cn(
                  "mt-1 text-sm",
                  accent ? "opacity-80" : "text-sea-800",
                )}
              >
                {description}
              </p>
            )}
          </div>
          {actions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-sea-800">{hint}</p>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  href,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  tone?: "default" | "warning" | "good";
}) {
  const body = (
    <div
      className={cn(
        "rounded-xl border bg-white p-5 transition-colors",
        tone === "warning" && "border-amber-300 bg-amber-50/60",
        tone === "good" && "border-emerald-300 bg-emerald-50/60",
        tone === "default" && "border-sea-200",
        href && "hover:border-sea-400",
      )}
    >
      <p className="text-sm text-sea-800">{label}</p>
      <p className="mt-2 font-serif text-2xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-sea-800">{hint}</p>}
    </div>
  );

  return href ? <Link href={href}>{body}</Link> : body;
}

export function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-sea-300 px-5 py-10 text-center text-sm text-sea-800">
      {children}
    </div>
  );
}
