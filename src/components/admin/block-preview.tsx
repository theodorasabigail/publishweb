import type { BlockType } from "@/lib/blocks";

/**
 * A little drawing of what each block looks like.
 *
 * Diagrams, not screenshots. A screenshot would show one particular photograph
 * and one particular sentence, which is exactly the thing that varies; what
 * the operator is choosing between is the *shape* — where the picture goes,
 * how much of the width it takes, where the words sit against it. So these are
 * wireframes: solid means picture, lines mean text, and the proportions are
 * the real ones.
 *
 * Inline SVG rather than image files: nothing to upload, nothing to keep in
 * step with the design, no storage used, and they stay sharp at any size.
 */

const FILL = "#c8d9dd"; // sea-200 — stands for a photograph
const LINE = "#547680"; // sea-600 — stands for text
const FAINT = "#e3ecee"; // sea-100 — page background

export function BlockPreview({ type }: { type: BlockType }) {
  return (
    <svg
      viewBox="0 0 120 72"
      className="h-[72px] w-[120px] shrink-0 border border-sea-200 bg-white"
      role="img"
      aria-hidden
    >
      {shapeFor(type)}
    </svg>
  );
}

/** A run of text lines, shortest last, the way a paragraph actually ends. */
function lines(x: number, y: number, width: number, count: number, gap = 5) {
  return Array.from({ length: count }, (_, index) => (
    <rect
      key={index}
      x={x}
      y={y + index * gap}
      width={index === count - 1 ? width * 0.6 : width}
      height={2}
      fill={LINE}
      opacity={0.55}
    />
  ));
}

function shapeFor(type: BlockType) {
  switch (type) {
    case "split":
      return (
        <>
          <rect x="0" y="0" width="60" height="72" fill={FILL} />
          {/* Heading, two lines of body, and the underlined link. */}
          <rect x="70" y="22" width="34" height="6" fill={LINE} />
          {lines(70, 34, 40, 2)}
          <rect x="70" y="50" width="18" height="2" fill={LINE} />
        </>
      );

    case "full_image":
      return (
        <>
          <rect x="0" y="0" width="120" height="72" fill={FILL} />
          <rect x="0" y="44" width="120" height="28" fill={LINE} opacity={0.22} />
          <rect x="8" y="52" width="46" height="7" fill="#ffffff" opacity={0.95} />
          <rect x="8" y="63" width="28" height="2" fill="#ffffff" opacity={0.8} />
        </>
      );

    case "statement":
      return (
        <>
          <rect x="34" y="20" width="52" height="7" fill={LINE} />
          <rect x="42" y="31" width="36" height="7" fill={LINE} />
          <rect x="44" y="46" width="32" height="2" fill={LINE} opacity={0.5} />
        </>
      );

    case "products":
      return (
        <>
          {[6, 34, 62, 90].map((x) => (
            <g key={x}>
              <rect x={x} y="14" width="24" height="24" fill={FILL} />
              <rect x={x} y="43" width="18" height="2" fill={LINE} opacity={0.6} />
              <rect x={x} y="49" width="11" height="2" fill={LINE} opacity={0.4} />
            </g>
          ))}
        </>
      );

    case "gallery":
      return (
        <>
          {[0, 30.5, 61, 91.5].map((x) => (
            <rect key={x} x={x} y="6" width="28.5" height="60" fill={FILL} />
          ))}
        </>
      );

    case "text":
      return <>{lines(34, 22, 52, 6)}</>;

    case "rule":
      return <rect x="14" y="35" width="92" height="1.5" fill={LINE} opacity={0.5} />;

    default:
      return <rect x="0" y="0" width="120" height="72" fill={FAINT} />;
  }
}
