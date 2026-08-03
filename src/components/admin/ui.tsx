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
        {description && <p className="mt-1 text-sm text-bark-600">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Panel({
  title,
  description,
  children,
  className,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-bark-200 bg-white", className)}>
      {(title || description) && (
        <div className="border-b border-bark-200 px-5 py-4">
          {title && <h2 className="font-medium">{title}</h2>}
          {description && <p className="mt-1 text-sm text-bark-600">{description}</p>}
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
      {hint && <p className="mt-1.5 text-xs text-bark-500">{hint}</p>}
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
        tone === "default" && "border-bark-200",
        href && "hover:border-bark-400",
      )}
    >
      <p className="text-sm text-bark-600">{label}</p>
      <p className="mt-2 font-serif text-2xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-bark-500">{hint}</p>}
    </div>
  );

  return href ? <Link href={href}>{body}</Link> : body;
}

export function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-bark-300 px-5 py-10 text-center text-sm text-bark-600">
      {children}
    </div>
  );
}
