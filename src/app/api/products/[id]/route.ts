// GET /api/products/[id] — товар по числовому id.
// Контракт (worklog.md): Product с вложенными category и images (orderBy sortOrder,
// select url/isMain). Для старых товаров без записей ProductImage — фолбэк
// images: [{ url: product.image, isMain: true }]. | 404 { error: "Товар не найден" }.
// PUT /api/products/[id] — обновление товара (CMS): те же поля, что POST, но все
// опциональны; slug не изменяется. images — полная замена набора фотографий
// (в транзакции: update + deleteMany + createMany); image без images — замена
// набора единственной записью { url: image, isMain: true }.
// Ответ: Product с category и images | 404 | 400.
// DELETE /api/products/[id] — удаление товара: CartItem и ProductImage удаляются
// каскадом, но товар в заказах удалить нельзя (внешний ключ OrderItem) → 409.
// Ответ: { ok: true } | 404 | 409.

import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { imageFileExists, parseProductInput } from "../_shared";

// Общий include для ответов: категория + фотографии галереи по порядку
const PRODUCT_INCLUDE = {
  category: { select: { id: true, slug: true, name: true } },
  images: { orderBy: { sortOrder: "asc" }, select: { url: true, isMain: true } },
} as const;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const productId = /^\d+$/.test(id) ? Number.parseInt(id, 10) : Number.NaN;

    if (!Number.isInteger(productId) || productId < 1) {
      return NextResponse.json({ error: "Товар не найден" }, { status: 404 });
    }

    const product = await db.product.findUnique({
      where: { id: productId },
      include: PRODUCT_INCLUDE,
    });

    if (!product) {
      return NextResponse.json({ error: "Товар не найден" }, { status: 404 });
    }

    // Старые товары без записей ProductImage: фолбэк — единственное главное фото
    if (product.images.length === 0) {
      return NextResponse.json({
        ...product,
        images: [{ url: product.image, isMain: true }],
      });
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error("GET /api/products/[id]:", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

// PUT /api/products/[id] — частичное обновление товара (валидируются только
// переданные поля); images/image — полная замена набора фотографий
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const productId = /^\d+$/.test(id) ? Number.parseInt(id, 10) : Number.NaN;

    if (!Number.isInteger(productId) || productId < 1) {
      return NextResponse.json({ error: "Товар не найден" }, { status: 404 });
    }

    const existing = await db.product.findUnique({
      where: { id: productId },
      include: PRODUCT_INCLUDE,
    });
    if (!existing) {
      return NextResponse.json({ error: "Товар не найден" }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    const parsed = parseProductInput(body, {
      partial: true,
      currentPrice: existing.price,
    });
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const data = parsed.data;

    // Категория должна существовать
    if (data.categoryId !== undefined) {
      const category = await db.category.findUnique({
        where: { id: data.categoryId },
      });
      if (!category) {
        return NextResponse.json({ error: "Категория не найдена" }, { status: 400 });
      }
    }

    // Файл фото должен существовать (проверка для image, переданного без images)
    if (data.image !== undefined && !(await imageFileExists(data.image))) {
      return NextResponse.json({ error: "Фото не найдено" }, { status: 400 });
    }

    // Новый набор фотографий (полная замена): images — массив записей;
    // image без images — единственная запись { url, isMain: true }
    let imageRows: { url: string; sortOrder: number; isMain: boolean }[] | null = null;
    if (data.images !== undefined) {
      // Каждый файл из набора должен существовать
      for (const image of data.images) {
        if (!(await imageFileExists(image.url))) {
          return NextResponse.json({ error: "Фото не найдено" }, { status: 400 });
        }
      }
      // Главное фото товара синхронизируем с набором
      data.image = data.images.find((image) => image.isMain)?.url ?? data.images[0].url;
      imageRows = data.images.map((image, index) => ({
        url: image.url,
        sortOrder: index,
        isMain: image.isMain,
      }));
    } else if (data.image !== undefined) {
      imageRows = [{ url: data.image, sortOrder: 0, isMain: true }];
    }

    // Пустое тело — просто возвращаем текущее состояние товара
    if (imageRows === null && Object.keys(data).length === 0) {
      // Старые товары без записей ProductImage: фолбэк из главного фото
      if (existing.images.length === 0) {
        return NextResponse.json({
          ...existing,
          images: [{ url: existing.image, isMain: true }],
        });
      }
      return NextResponse.json(existing);
    }

    // Скалярные поля товара (фотографии обновляются отдельными запросами)
    const { images: _images, ...productData } = data;

    if (imageRows === null) {
      // Обычное обновление скалярных полей (фотографии не меняются)
      const product = await db.product.update({
        where: { id: productId },
        data: productData,
        include: PRODUCT_INCLUDE,
      });
      return NextResponse.json(product);
    }

    // Полная замена набора фотографий — атомарно в транзакции:
    // обновление полей (включая главное фото) + удаление старых записей + создание новых
    await db.$transaction([
      db.product.update({
        where: { id: productId },
        data: productData,
      }),
      db.productImage.deleteMany({ where: { productId } }),
      db.productImage.createMany({
        data: imageRows.map((row) => ({ ...row, productId })),
      }),
    ]);

    // Свежее состояние товара после замены набора
    const product = await db.product.findUnique({
      where: { id: productId },
      include: PRODUCT_INCLUDE,
    });
    if (!product) {
      return NextResponse.json({ error: "Товар не найден" }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error("PUT /api/products/[id]:", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

// DELETE /api/products/[id] — удаление товара (при ошибке внешнего ключа — 409)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const productId = /^\d+$/.test(id) ? Number.parseInt(id, 10) : Number.NaN;

    if (!Number.isInteger(productId) || productId < 1) {
      return NextResponse.json({ error: "Товар не найден" }, { status: 404 });
    }

    const existing = await db.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Товар не найден" }, { status: 404 });
    }

    try {
      // CartItem и ProductImage удалятся каскадом; OrderItem держит внешний ключ
      await db.product.delete({ where: { id: productId } });
    } catch (deleteError) {
      const isForeignKeyError =
        (deleteError instanceof Prisma.PrismaClientKnownRequestError &&
          deleteError.code === "P2003") ||
        String(deleteError).includes("FOREIGN KEY");
      if (isForeignKeyError) {
        return NextResponse.json(
          { error: "Нельзя удалить товар, который уже есть в заказах" },
          { status: 409 }
        );
      }
      throw deleteError;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/products/[id]:", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
