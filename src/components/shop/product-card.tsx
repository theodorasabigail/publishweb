import Image from "next/image";
import Link from "next/link";
import { lowestPrice, totalStock } from "@/lib/product";
import type { ProductWithVariants } from "@/lib/types";
import { contrastText, formatIDR } from "@/lib/utils";

/**
 * The coloured product card. `accent_color` is set per product in the admin
 * (spec §7.2), so the operator can re-colour the shop without touching code.
 */
export function ProductCard({ product }: { product: ProductWithVariants }) {
  const price = lowestPrice(product);
  const stock = totalStock(product);
  const soldOut = stock <= 0;
  const textColor = contrastText(product.accent_color);

  return (
    <Link
      href={`/shop/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-sea-200/70 bg-white transition-shadow hover:shadow-lg"
    >
      <div
        className="relative aspect-[4/5] overflow-hidden"
        style={{ backgroundColor: product.accent_color }}
      >
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.image_alt ?? product.name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center p-6 text-center"
            style={{ color: textColor }}
          >
            <span className="font-serif text-2xl leading-tight opacity-90">
              {product.name}
            </span>
          </div>
        )}

        {product.is_featured && !soldOut && (
          <span className="absolute left-3 top-3 badge bg-cream/95 text-sea-900">
            Featured
          </span>
        )}
        {soldOut && (
          <span className="absolute left-3 top-3 badge bg-ink/85 text-cream">
            Sold out
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        {product.origin && (
          <p className="text-xs uppercase tracking-wider text-sea-800">
            {product.origin}
          </p>
        )}
        <h3 className="mt-1 text-lg font-semibold">{product.name}</h3>
        {product.tasting_notes && (
          <p className="mt-1 line-clamp-2 text-sm text-sea-800">
            {product.tasting_notes}
          </p>
        )}

        <div className="mt-auto flex items-baseline gap-1.5 pt-4">
          {price !== null ? (
            <>
              <span className="text-xs text-sea-800">from</span>
              <span className="font-medium">{formatIDR(price)}</span>
            </>
          ) : (
            <span className="text-sm text-sea-800">Price on request</span>
          )}
        </div>
      </div>
    </Link>
  );
}
