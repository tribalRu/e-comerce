// POST /api/orders — оформление заказа из текущей корзины.
// Контракт (worklog.md): body { customerName, phone, email?, address,
// delivery: "pickup"|"courier", payment: "card"|"cash", comment? }.
// Создаёт Order (number = КМ-<6 случайных цифр>, total = subtotal, снапшот items
// в OrderItem), очищает корзину, 201 { ok: true, order: { id, number, total, itemsCount } }.

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { readCartId } from "../cart/_state";

type OrderBody = {
  customerName?: unknown;
  phone?: unknown;
  email?: unknown;
  address?: unknown;
  delivery?: unknown;
  payment?: unknown;
  comment?: unknown;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Некорректное тело запроса" },
        { status: 400 }
      );
    }
    const data = body as OrderBody;

    // Корзина (cookie может не быть — тогда она пуста)
    const cartId = await readCartId();
    const cartItems = cartId
      ? await db.cartItem.findMany({
          where: { cartId },
          orderBy: { createdAt: "asc" },
          include: { product: true },
        })
      : [];

    if (!cartId || cartItems.length === 0) {
      return NextResponse.json({ error: "Корзина пуста" }, { status: 400 });
    }

    // Валидация полей
    const customerName =
      typeof data.customerName === "string" ? data.customerName.trim() : "";
    if (customerName.length < 2) {
      return NextResponse.json(
        { error: "Укажите имя (минимум 2 символа)" },
        { status: 400 }
      );
    }

    const phone = typeof data.phone === "string" ? data.phone : "";
    if (phone.replace(/\D/g, "").length < 7) {
      return NextResponse.json(
        { error: "Укажите корректный телефон (минимум 7 цифр)" },
        { status: 400 }
      );
    }

    if (data.delivery !== "pickup" && data.delivery !== "courier") {
      return NextResponse.json(
        { error: "Укажите способ доставки (pickup или courier)" },
        { status: 400 }
      );
    }
    const delivery = data.delivery;

    if (data.payment !== "card" && data.payment !== "cash") {
      return NextResponse.json(
        { error: "Укажите способ оплаты (card или cash)" },
        { status: 400 }
      );
    }
    const payment = data.payment;

    const address =
      typeof data.address === "string" ? data.address.trim() : "";
    if (delivery === "courier" && address.length < 5) {
      return NextResponse.json(
        { error: "Укажите адрес доставки (минимум 5 символов)" },
        { status: 400 }
      );
    }

    const email =
      typeof data.email === "string" && data.email.trim() !== ""
        ? data.email.trim()
        : null;
    const comment =
      typeof data.comment === "string" && data.comment.trim() !== ""
        ? data.comment.trim()
        : null;

    const count = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = cartItems.reduce(
      (sum, item) => sum + item.quantity * item.product.price,
      0
    );
    const number = `КМ-${Math.floor(100000 + Math.random() * 900000)}`;

    // Создание заказа со снапшотом позиций + очистка корзины — атомарно
    const order = await db.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          number,
          cartId,
          customerName,
          phone,
          email,
          address: address.length > 0 ? address : null,
          delivery,
          payment,
          comment,
          total: subtotal,
          items: {
            create: cartItems.map((item) => ({
              productId: item.productId,
              name: item.product.name,
              price: item.product.price,
              image: item.product.image,
              quantity: item.quantity,
            })),
          },
        },
      });
      await tx.cartItem.deleteMany({ where: { cartId } });
      return created;
    });

    return NextResponse.json(
      {
        ok: true,
        order: {
          id: order.id,
          number: order.number,
          total: order.total,
          itemsCount: count,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/orders:", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
