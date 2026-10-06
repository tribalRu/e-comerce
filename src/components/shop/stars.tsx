import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

// Пять звёзд рейтинга (как в карточках Target)

export function Stars({ rating, className = "" }: { rating: number; className?: string }) {
  const rounded = Math.round(rating);
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`Рейтинг ${rating.toFixed(1)} из 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          aria-hidden="true"
          className={cn(
            "size-3.5 shrink-0",
            i < rounded ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200",
          )}
        />
      ))}
    </span>
  );
}
