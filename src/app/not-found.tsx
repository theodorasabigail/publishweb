import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="text-center">
        <p className="font-serif text-6xl">404</p>
        <h1 className="mt-4 text-2xl">We couldn&apos;t find that page</h1>
        <p className="mt-2 text-sea-800">
          It may have been moved, or the lot may have sold out.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/" className="btn-primary">
            Go home
          </Link>
          <Link href="/shop" className="btn-secondary">
            Browse coffee
          </Link>
        </div>
      </div>
    </div>
  );
}
