import Link from "next/link";

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
      <p className="font-serif text-xl">{title}</p>
      {description && <p className="max-w-md text-sm text-sea-800">{description}</p>}
      {actionLabel && actionHref && (
        <Link href={actionHref} className="btn-secondary mt-2">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
