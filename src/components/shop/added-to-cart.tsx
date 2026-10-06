"use client";

// Боковая выезжающая панель «Добавлено в корзину» в стиле Target:
// появляется справа при добавлении товара — чек-иконка, добавленный товар,
// прогресс бесплатной доставки, итог по корзине и кнопки действий

import Image from "next/image";
import { CheckCircle2, Truck } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { FREE_DELIVERY_FROM, formatPrice, pluralize } from "./utils";
import type { CartApi } from "./use-cart";
import type { Product } from "./types";

interface AddedToCartDrawerProps {
  product: Product | null;
  quantity: number;
  cart: CartApi;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewCart: () => void;
}

export function AddedToCartDrawer({
  product,
  quantity,
  cart,
  open,
  onOpenChange,
  onViewCart,
}: AddedToCartDrawerProps) {
  const left = FREE_DELIVERY_FROM - cart.subtotal;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md"
      >
        <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-4 pr-12 sm:px-5">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#CC0000]"
            aria-hidden="true"
          >
            <CheckCircle2 className="size-5 text-white" />
          </span>
          <SheetTitle className="text-lg font-extrabold text-gray-900">
            Добавлено в корзину
          </SheetTitle>
        </div>
        <SheetDescription className="sr-only">
          Товар успешно добавлен в корзину
        </SheetDescription>

        {product && (
          <div className="flex gap-4 px-4 py-4 sm:px-5">
            <div className="relative size-24 shrink-0 overflow-hidden rounded-lg bg-[#F7F7F7] ring-1 ring-gray-200/60">
              <Image
                src={product.image}
                alt={product.name}
                fill
                sizes="96px"
                unoptimized
                className="object-cover"
              />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                {product.brand}
              </p>
              <p className="mt-0.5 line-clamp-2 text-sm font-medium leading-snug text-gray-900">
                {product.name}
              </p>
              <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
                <span
                  className={cn(
                    "text-base font-extrabold leading-none",
                    product.oldPrice ? "text-[#CC0000]" : "text-gray-900",
                  )}
                >
                  {formatPrice(product.price * quantity)}
                </span>
                {product.oldPrice && (
                  <span className="text-sm text-gray-400 line-through">
                    {formatPrice(product.oldPrice * quantity)}
                  </span>
                )}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {quantity} {pluralize(quantity, "штука", "штуки", "штук")} ×{" "}
                {formatPrice(product.price)}
              </p>
            </div>
          </div>
        )}

        <div className="border-y border-gray-100 bg-[#FDF4F4] px-4 py-3 sm:px-5">
          {left > 0 ? (
            <>
              <p className="text-[13px] text-gray-700">
                До бесплатной доставки:{" "}
                <span className="font-bold text-[#CC0000]">{formatPrice(left)}</span>
              </p>
              <Progress
                value={(cart.subtotal / FREE_DELIVERY_FROM) * 100}
                className="mt-2 h-1.5 bg-white [&>div]:bg-[#CC0000]"
                aria-label="Прогресс до бесплатной доставки"
              />
            </>
          ) : (
            <p className="flex items-center gap-2 text-[13px] font-semibold text-emerald-700">
              <Truck className="size-4 shrink-0" aria-hidden="true" />
              Доставка бесплатная — поздравляем!
            </p>
          )}
        </div>

        <div className="mt-auto space-y-3 px-4 py-4 sm:px-5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-gray-600">
              В корзине{" "}
              <span className="font-bold text-gray-900">
                {cart.count}{" "}
                {pluralize(cart.count, "товар", "товара", "товаров")}
              </span>
            </span>
            <span className="text-base font-extrabold tabular-nums text-gray-900">
              {formatPrice(cart.subtotal)}
            </span>
          </div>
          <button
            type="button"
            onClick={onViewCart}
            className="h-12 w-full rounded-full bg-gray-900 text-sm font-bold text-white transition-colors hover:bg-black"
          >
            Посмотреть корзину и оформить
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-10 w-full rounded-full text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100"
          >
            Продолжить покупки
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
