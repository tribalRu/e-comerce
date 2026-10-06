"use client";

// Корзина: выезжающая панель с количеством, прогрессом бесплатной доставки и итогом

import Image from "next/image";
import { ShoppingBag, Trash2, Truck } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { QuantityStepper } from "./quantity-stepper";
import { FREE_DELIVERY_FROM, formatPrice } from "./utils";
import type { CartApi } from "./use-cart";

interface CartDrawerProps {
  cart: CartApi;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCheckout: () => void;
}

export function CartDrawer({ cart, open, onOpenChange, onCheckout }: CartDrawerProps) {
  const left = FREE_DELIVERY_FROM - cart.subtotal;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md" side="right">
        <div className="flex items-center border-b border-gray-100 px-4 py-4 sm:px-5">
          <SheetTitle className="text-lg font-extrabold text-gray-900">
            Корзина
            {cart.count > 0 && <span className="ml-2 text-sm font-bold text-[#CC0000]">{cart.count}</span>}
          </SheetTitle>
        </div>
        <SheetDescription className="sr-only">Товары, добавленные в корзину</SheetDescription>

        {cart.items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-gray-100 text-gray-400">
              <ShoppingBag className="size-8" aria-hidden="true" />
            </span>
            <p className="text-base font-bold text-gray-900">В корзине пока пусто</p>
            <p className="max-w-[260px] text-sm text-gray-500">
              Загляните в каталог — там куклы на любой вкус и бюджет.
            </p>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="mt-2 rounded-full bg-[#CC0000] px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#A80000]"
            >
              Перейти к каталогу
            </button>
          </div>
        ) : (
          <>
            <div className="border-b border-gray-100 bg-[#FDF4F4] px-4 py-3 sm:px-5">
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
                  Поздравляем — доставка бесплатная
                </p>
              )}
            </div>

            <ul className="thin-scrollbar flex-1 divide-y divide-gray-100 overflow-y-auto px-4 py-4 sm:px-5">
              {cart.items.map((item) => (
                <li key={item.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-[#F7F7F7] ring-1 ring-gray-200/60">
                    <Image
                      src={item.product.image}
                      alt={item.product.name}
                      fill
                      sizes="80px"
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="line-clamp-2 text-sm font-medium leading-snug text-gray-900">
                      {item.product.name}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">{formatPrice(item.product.price)} / шт.</p>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                      <QuantityStepper
                        size="sm"
                        value={item.quantity}
                        min={1}
                        max={item.product.stock}
                        disabled={cart.busy}
                        onChange={(value) => void cart.updateQty(item.id, value)}
                        label={`Количество: ${item.product.name}`}
                      />
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "text-sm font-extrabold tabular-nums",
                            item.product.oldPrice ? "text-[#CC0000]" : "text-gray-900",
                          )}
                        >
                          {formatPrice(item.product.price * item.quantity)}
                        </span>
                        <button
                          type="button"
                          onClick={() => void cart.removeItem(item.id)}
                          disabled={cart.busy}
                          aria-label={`Удалить: ${item.product.name}`}
                          className="text-gray-400 transition-colors hover:text-[#CC0000] disabled:opacity-50"
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="space-y-3 border-t border-gray-200 bg-white px-4 py-4 sm:px-5">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-gray-600">Товары ({cart.count})</span>
                <span className="text-base font-extrabold text-gray-900">{formatPrice(cart.subtotal)}</span>
              </div>
              <p className="text-xs text-gray-400">
                Доставку рассчитаем при оформлении — она бесплатна от 3 000 ₽
              </p>
              <button
                type="button"
                onClick={onCheckout}
                className="h-12 w-full rounded-full bg-[#CC0000] text-sm font-bold text-white transition-colors hover:bg-[#A80000]"
              >
                Оформить заказ
              </button>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="h-10 w-full rounded-full text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100"
              >
                Продолжить покупки
              </button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
