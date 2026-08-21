import Image from "next/image";
import Link from "next/link";
import { lowestPrice, totalStock } from "@/lib/product";
import type { ProductWithVariants } from "@/lib/types";
import {
  FLAVOUR_SWATCH_RING,
  FLAVOUR_SWATCH_RING_COLOR,
  flavourFor,
  productColour,
} from "@/lib/flavour";
import { contrastText, formatIDR } from "@/lib/utils";

/**
 * A coffee in a grid.
 *
 * The ground it sits on is its flavour colour — the same one printed on the
 * bag — so the shop and the packaging agree at a glance. Level 1 is very
 * nearly white, so the panel carries a hairline; it is invisible on the deeper
 * colours and load-bearing on the pale end.
 *
 * No border, no shadow, no rounded panel. The picture is the card: it sits on
 * a flat field of the coffee's own colour and runs to the edges of its cell,
 * and the words underneath are small and quiet. The chrome was doing nothing
 * except announcing that this is software.
 *
 * `accent_color` is set per product in the admin (spec §7.2), so the operator
 * can re-colour the shop without touching code.
 */
export function ProductCard({ product }: { product: ProductWithVariants }) {
  const price = lowestPrice(product);
  const stock = totalStock(product);
  const flavour = flavourFor(product.flavour_level);
  const soldOut = stock <= 0;
  const colour = productColour(product);
  const textColor = contrastText(colour);

  return (
    <Link
      href={`/shop/${product.slug}`}
      className="group flex flex-col"
    >
      <div
        className="relative aspect-square overflow-hidden"
        style={{
          backgroundColor: colour,
          // Inset rather than a border, so the hairline does not change the
          // square the photograph has to fill.
          boxShadow: `inset 0 0 0 1px ${FLAVOUR_SWATCH_RING_COLOR}`,
        }}
      >
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.image_alt ?? product.name}
            fill
            sizes="(max-width: 768px) 50vw, 33vw"
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

        {/* Flat rectangles in the corner, the way a shop tags a rail. A pill
            floating over a photograph reads as an interface element. */}
        {product.is_featured && !soldOut && (
          <span className="absolute left-0 top-0 bg-cream px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ink">
            Featured
          </span>
        )}
        {soldOut && (
          <span className="absolute left-0 top-0 bg-ink px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-cream">
            Sold out
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col pt-3.5">
        <div className="flex items-center gap-2">
          {/* The flavour colour, at the top of the card where it is scanned
              before the name is read. Titled rather than labelled, so it does
              not compete with the coffee's own name for space. */}
          {flavour && (
            <span
              className="h-3.5 w-3.5 shrink-0 rounded-full"
              style={{ backgroundColor: flavour.hex, border: FLAVOUR_SWATCH_RING }}
              title={`${flavour.label} — ${flavour.description}`}
            />
          )}
          {product.origin && (
            <p className="truncate text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-sea-800">
              {product.origin}
            </p>
          )}
        </div>

        <h3 className="mt-2 text-sm font-semibold uppercase tracking-[0.04em] group-hover:underline group-hover:underline-offset-4">
          {product.name}
        </h3>

        {product.tasting_notes && (
          <p className="mt-1 line-clamp-1 text-sm text-sea-800">
            {product.tasting_notes}
          </p>
        )}

        <div className="mt-auto pt-2.5 text-sm">
          {price !== null ? (
            <span className="tabular-nums">{formatIDR(price)}</span>
          ) : (
            <span className="text-sea-800">Price on request</span>
          )}
        </div>
      </div>
    </Link>
  );
}
