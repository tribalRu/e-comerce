// /api/cart/[itemId] — PATCH (изменить количество) и DELETE (удалить позицию).
// Контракт (worklog.md): item должен принадлежать текущей корзине (иначе 404);
// quantity <= 0 удаляет позицию; quantity ограничивается product.stock.

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCartState, readCartId, toIntOrNull } from "../_state";

// PATCH /api/cart/[itemId] — body { quantity: number }.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const cartId = await readCartId();
    if (!cartId) {
      return NextResponse.json(
        { error: "Элемент корзины не найден" },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => null);
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Некорректное тело запроса" },
        { status: 400 }
      );
    }
    const quantity = toIntOrNull((body as Record<string, unknown>).quantity);
    if (quantity === null) {
      return NextResponse.json(
        { error: "Некорректное количество (ожидается целое число)" },
        { status: 400 }
      );
    }

    const item = await db.cartItem.findFirst({
      where: { id: itemId, cartId },
      include: { product: { select: { stock: true } } },
    });
    if (!item) {
      return NextResponse.json(
        { error: "Элемент корзины не найден" },
        { status: 404 }
      );
    }

    if (quantity <= 0) {
      await db.cartItem.delete({ where: { id: item.id } });
    } else {
      await db.cartItem.update({
        where: { id: item.id },
        data: { quantity: Math.min(quantity, item.product.stock) },
      });
    }

    return NextResponse.json(await getCartState(cartId));
  } catch (error) {
    console.error("PATCH /api/cart/[itemId]:", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

// DELETE /api/cart/[itemId] — удаляет позицию (с проверкой владения).
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const cartId = await readCartId();
    if (!cartId) {
      return NextResponse.json(
        { error: "Элемент корзины не найден" },
        { status: 404 }
      );
    }

    const item = await db.cartItem.findFirst({
      where: { id: itemId, cartId },
    });
    if (!item) {
      return NextResponse.json(
        { error: "Элемент корзины не найден" },
        { status: 404 }
      );
    }

    await db.cartItem.delete({ where: { id: item.id } });
    return NextResponse.json(await getCartState(cartId));
  } catch (error) {
    console.error("DELETE /api/cart/[itemId]:", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
