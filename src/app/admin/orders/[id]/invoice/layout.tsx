/**
 * Nested layout for the invoice page.
 *
 * Adds a fixed, full-viewport, white surface above the admin chrome, so the
 * operator sees the receipt on its own -- no sidebar, no dashboard header --
 * the way it will actually print. The admin layout still wraps this (route
 * layouts nest downward and cannot be escaped without a route group), but
 * every visible thing it adds sits behind this z-50 overlay.
 *
 * @media print in the invoice's own styles handles the printed page: the
 * button row disappears, the surface fills the sheet, no fixed positioning
 * is preserved. The overlay is purely a screen-time correction.
 */
export default function InvoiceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-white print:static print:overflow-visible">
      {children}
    </div>
  );
}
