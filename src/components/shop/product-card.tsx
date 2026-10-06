"use client";

// Карточка товара в стиле Target: фото, бейдж, рейтинг, цена, кнопка «В корзину» при ховере

import Image from "next/image";
import { ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { Stars } from "./stars";
import { BADGE_LABELS, formatPrice } from "./utils";
import type { Product } from "./types";

const BADGE_STYLES: Record<string, string> = {
  hit: "bg-[#CC0000] text-white",
  new: "bg-emerald-600 text-white",
  sale: "bg-white text-[#CC0000] ring-1 ring-[#CC0000]",
  deal: "bg-gray-900 text-white",
};

interface ProductCardProps {
  product: Product;
  onOpen: (product: Product) => void;
  onAdd: (product: Product) => void;
  /** false — кнопка быстрого добавления скрыта (корзина выключена в админке) */
  canAdd?: boolean;
}

export function ProductCard({ product, onOpen, onAdd, canAdd = true }: ProductCardProps) {
  const discount = product.oldPrice ? Math.round((1 - product.price / product.oldPrice) * 100) : 0;
  const badgeLabel = product.badge ? BADGE_LABELS[product.badge] : undefined;

  return (
    <article className="group flex flex-col">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-[#F7F7F7] ring-1 ring-gray-200/70 transition-shadow group-hover:shadow-md">
        <button
          type="button"
          onClick={() => onOpen(product)}
          className="absolute inset-0 size-full cursor-pointer"
          aria-label={`Открыть карточку: ${product.name}`}
        >
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            unoptimized
            className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        </button>

        {badgeLabel && (
          <span
            className={cn(
              "absolute left-2.5 top-2.5 rounded-full px-2.5 py-1 text-[11px] font-bold leading-none shadow-sm",
              BADGE_STYLES[product.badge as string],
            )}
          >
            {badgeLabel}
          </span>
        )}

        {canAdd && (
          <button
            type="button"
            onClick={() => onAdd(product)}
            className="absolute inset-x-3 bottom-3 hidden h-10 translate-y-2 items-center justify-center gap-2 rounded-full bg-[#CC0000] text-sm font-bold text-white opacity-0 shadow-md transition-all duration-200 hover:bg-[#A80000] focus-visible:translate-y-0 focus-visible:opacity-100 group-hover:translate-y-0 group-hover:opacity-100 md:flex"
          >
            <ShoppingCart className="size-4" aria-hidden="true" />
            В корзину
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => onOpen(product)}
        className="mt-2.5 flex flex-1 flex-col items-start text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">{product.brand}</span>
        <span className="mt-0.5 line-clamp-2 text-sm font-medium leading-snug text-gray-900">{product.name}</span>
        <span className="mt-1.5 flex items-center gap-1.5">
          <Stars rating={product.rating} />
          <span className="text-xs text-gray-500">({product.reviewsCount})</span>
        </span>
        <span className="mt-2 flex flex-wrap items-baseline gap-x-2">
          <span
            className={cn("text-lg font-extrabold leading-none", product.oldPrice ? "text-[#CC0000]" : "text-gray-900")}
          >
            {formatPrice(product.price)}
          </span>
          {product.oldPrice && (
            <>
              <span className="text-sm text-gray-400 line-through">{formatPrice(product.oldPrice)}</span>
              <span className="text-xs font-bold text-[#CC0000]">−{discount}%</span>
            </>
          )}
        </span>
      </button>
    </article>
  );
}
