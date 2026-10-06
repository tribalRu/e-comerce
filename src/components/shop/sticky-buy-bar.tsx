"use client";

// Липкая панель покупки (как на референсе Target PDP): появляется под шапкой,
// когда блок с ценой, количеством и кнопкой «Добавить в корзину» уходит вверх
// при прокрутке, и скрывается, когда блок снова становится виден.
// Слева — миниатюра товара, ссылка на категорию и название (с усечением);
// справа — цена и степпер количества, синхронный с основным блоком покупки.
// Кнопки «Добавить в корзину» в панели нет — как на референсе.

import Image from "next/image";
import { cn } from "@/lib/utils";
import { QuantityStepper } from "./quantity-stepper";
import { clamp, formatPrice } from "./utils";
import type { Product } from "./types";

interface StickyBuyBarProps {
  product: Product;
  visible: boolean;
  quantity: number;
  onQuantityChange: (value: number) => void;
  onGoCategory: (slug: string) => void;
}

// Высота шапки сайта: красная полоса h-3 (12px) + основной бар h-16 (64px).
// Панель встаёт вплотную под шапкой (шапка z-50, панель z-40 — прячется за ней).
const HEADER_HEIGHT = 76;

export function StickyBuyBar({
  product,
  visible,
  quantity,
  onQuantityChange,
  onGoCategory,
}: StickyBuyBarProps) {
  const max = Math.max(product.stock, 1);

  return (
    <div
      role="region"
      aria-label="Панель товара: цена и количество"
      aria-hidden={!visible}
      className={cn(
        "fixed inset-x-0 z-40 border-b border-gray-200 bg-white",
        "shadow-[0_6px_16px_rgba(0,0,0,0.08)]",
        "transition-[transform,visibility] duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
        visible ? "visible translate-y-0" : "invisible -translate-y-full",
      )}
      style={{ top: HEADER_HEIGHT }}
    >
      <div className="shop-container flex h-16 items-center gap-2.5 sm:gap-4">
        {/* Миниатюра товара (как на референсе) */}
        <div className="relative size-12 shrink-0 overflow-hidden rounded-md bg-[#F7F7F7] ring-1 ring-gray-200/70">
          <Image
            src={product.image}
            alt=""
            fill
            sizes="48px"
            unoptimized
            className="object-cover"
          />
        </div>

        {/* Ссылка на категорию + название товара — как «Shop all …» на референсе.
            На мобильных ссылку на категорию скрываем: одна строка названия,
            как в мобильной панели Target */}
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <button
            type="button"
            onClick={() => onGoCategory(product.category.slug)}
            className="hidden max-w-full truncate rounded-sm text-xs font-medium text-gray-500 transition-colors hover:text-[#CC0000] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC0000]/30 sm:block"
          >
            Все товары: {product.category.name}
          </button>
          <p className="truncate text-sm font-bold text-gray-900 sm:mt-0.5 sm:text-[15px]">
            {product.name}
          </p>
        </div>

        {/* Цена и степпер количества — справа, как на референсе */}
        <div className="flex shrink-0 items-center gap-2.5 sm:gap-4">
          <span className="whitespace-nowrap text-[15px] font-extrabold tracking-tight text-gray-900 sm:text-lg">
            {formatPrice(product.price)}
          </span>
          <QuantityStepper
            size="sm"
            value={quantity}
            onChange={(value) => onQuantityChange(clamp(value, 1, max))}
            max={max}
            label="Количество (панель сверху)"
          />
        </div>
      </div>
    </div>
  );
}
