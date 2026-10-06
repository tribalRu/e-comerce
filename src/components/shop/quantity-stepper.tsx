"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  size?: "sm" | "md";
  disabled?: boolean;
  label?: string;
}

// Степпер количества: круглые кнопки плюс/минус

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  size = "md",
  disabled = false,
  label = "Количество",
}: QuantityStepperProps) {
  return (
    <div
      className={cn("inline-flex items-center rounded-full border border-gray-300 bg-white", size === "sm" ? "h-8" : "h-11")}
      role="group"
      aria-label={label}
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        aria-label="Уменьшить количество"
        className="flex h-full w-9 items-center justify-center rounded-l-full text-gray-600 transition-colors hover:text-[#CC0000] disabled:pointer-events-none disabled:opacity-40"
      >
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <span aria-live="polite" className="w-8 text-center text-sm font-bold tabular-nums text-gray-900">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        aria-label="Увеличить количество"
        className="flex h-full w-9 items-center justify-center rounded-r-full text-gray-600 transition-colors hover:text-[#CC0000] disabled:pointer-events-none disabled:opacity-40"
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
