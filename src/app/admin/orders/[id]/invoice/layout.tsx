/**
 * The invoice sits under /admin so admin auth still guards it, but it renders
 * *outside* the admin frame — no side nav, no top bar, no admin container.
 *
 * A layout that returns its children unwrapped overrides the segment above,
 * which is exactly what an operator wants to see and what a Ctrl-P dialog
 * should have to work with.
 */
export default function InvoiceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-cream">{children}</div>;
}
