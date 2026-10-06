// /api/cart — GET (состояние), POST (добавить товар), DELETE (очистить).
// Контракт (worklog.md): все ответы — состояние корзины
// { cartId: string|null, items: [{ id, quantity, product }], count, subtotal }.

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCartState, readCartId, toIntOrNull, writeCartCookie } from "./_state";

// GET /api/cart — состояние корзины; cookie НЕ создаёт.
export async function GET() {
  try {
    const cartId = await readCartId();
    return NextResponse.json(await getCartState(cartId));
  } catch (error) {
    console.error("GET /api/cart:", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

// POST /api/cart — body { productId: number, quantity?: number >= 1 (default 1) }.
// Создаёт cookie km_cart при отсутствии, upsert CartItem (инкремент),
// quantity ограничивается product.stock.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Некорректное тело запроса" }, { status: 400 });
    }

    const fields = body as Record<string, unknown>;
    const productId = toIntOrNull(fields.productId);
    if (productId === null || productId < 1) {
      return NextResponse.json(
        { error: "Некорректный productId" },
        { status: 400 }
      );
    }
    const quantity =
      fields.quantity === undefined ? 1 : toIntOrNull(fields.quantity);
    if (quantity === null || quantity < 1) {
      return NextResponse.json(
        { error: "Некорректное количество (ожидается целое число ≥ 1)" },
        { status: 400 }
      );
    }

    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product) {
      return NextResponse.json({ error: "Товар не найден" }, { status: 400 });
    }

    let cartId = await readCartId();
    if (!cartId) {
      cartId = crypto.randomUUID();
      await writeCartCookie(cartId);
    }

    const existing = await db.cartItem.findUnique({
      where: { cartId_productId: { cartId, productId } },
    });
    if (existing) {
      await db.cartItem.update({
        where: { id: existing.id },
        data: { quantity: Math.min(existing.quantity + quantity, product.stock) },
      });
    } else {
      await db.cartItem.create({
        data: {
          cartId,
          productId,
          quantity: Math.min(quantity, product.stock),
        },
      });
    }

    return NextResponse.json(await getCartState(cartId));
  } catch (error) {
    console.error("POST /api/cart:", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

// DELETE /api/cart — удаляет все товары текущей корзины.
export async function DELETE() {
  try {
    const cartId = await readCartId();
    if (cartId) {
      await db.cartItem.deleteMany({ where: { cartId } });
    }
    return NextResponse.json(await getCartState(cartId));
  } catch (error) {
    console.error("DELETE /api/cart:", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
