import type { ReactNode } from "react";

// Заголовок секции с красной полоской-акцентом (фирменный приём Target)

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <div className="flex items-center gap-3">
          <span className="block h-7 w-1.5 rounded-full bg-[#CC0000]" aria-hidden="true" />
          <h2 className="text-xl font-extrabold tracking-tight text-gray-900 sm:text-2xl">{title}</h2>
        </div>
        {subtitle ? <p className="mt-1.5 hidden text-sm text-gray-500 sm:block">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
