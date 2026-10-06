// Общая логика корзины для cart-эндпоинтов и оформления заказа.
// Контракты см. worklog.md (Task 2-b). Файл не является роутом (route.ts).

import { cookies } from "next/headers";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export const CART_COOKIE = "km_cart";
const THIRTY_DAYS_IN_SECONDS = 60 * 60 * 24 * 30; // maxAge cookie корзины

const productInclude = {
  category: { select: { id: true, slug: true, name: true } },
} satisfies Prisma.ProductInclude;

export type ProductWithCategory = Prisma.ProductGetPayload<{
  include: typeof productInclude;
}>;

/** Читает cartId из cookie km_cart (cookie НЕ создаёт). */
export async function readCartId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(CART_COOKIE)?.value ?? null;
}

/** Ставит cookie km_cart: uuid, httpOnly, sameSite=lax, path=/, 30 дней. */
export async function writeCartCookie(cartId: string): Promise<void> {
  const jar = await cookies();
  jar.set(CART_COOKIE, cartId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: THIRTY_DAYS_IN_SECONDS,
  });
}

/**
 * Состояние корзины — форма ответа ВСЕХ cart-эндпоинтов:
 * { cartId: string|null, items: [{ id, quantity, product }], count, subtotal }
 * (items по createdAt asc; count = сумма количеств; subtotal = сумма price*quantity)
 */
export async function getCartState(cartId: string | null) {
  if (!cartId) {
    return { cartId: null, items: [], count: 0, subtotal: 0 };
  }
  const cartItems = await db.cartItem.findMany({
    where: { cartId },
    orderBy: { createdAt: "asc" },
    include: { product: { include: productInclude } },
  });
  const items = cartItems.map((item) => ({
    id: item.id,
    quantity: item.quantity,
    product: item.product,
  }));
  const count = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.quantity * item.product.price,
    0
  );
  return { cartId, items, count, subtotal };
}

/** Целое число из JSON-поля (number или строка из цифр), иначе null. */
export function toIntOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
    return Number.parseInt(value.trim(), 10);
  }
  return null;
}
