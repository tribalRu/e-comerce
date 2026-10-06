// Логотип «КуклаМаркет» — яблочко в духе Target

export function BullseyeLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label="КуклаМаркет">
      <circle cx="50" cy="50" r="48" fill="#CC0000" />
      <circle cx="50" cy="50" r="31" fill="#FFFFFF" />
      <circle cx="50" cy="50" r="14" fill="#CC0000" />
    </svg>
  );
}
