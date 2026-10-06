// GET /api/products — каталог с фильтрами.
// Контракт (worklog.md): JSON-массив товаров с вложенным category: { id, slug, name }.
// Параметры: category=<slug>, search=<q>, sort=popular|price_asc|price_desc|rating|new,
// featured=1, limit=N. search — регистронезависимо по name+description (в JS,
// т.к. SQLite contains чувствителен к регистру).
// POST /api/products — создание товара (CMS). Тело: { name, brand?, categoryId, price,
// oldPrice?, description, image, badge?, ageMin?, stock?, rating?, reviewsCount?,
// featured?, images? }. images — массив фотографий галереи (контракт Task 12):
// при его наличии поле image игнорируется (главное фото выводится из набора),
// иначе — прежний контракт с обязательным image.
// rating/reviewsCount передаёт только seed/API — в админке они не редактируются:
// без полей новый товар создаётся с rating 0 и 0 отзывов (будут рассчитаны
// автоматически из реальных отзывов покупателей системой отзывов).
// Ответ: 201 Product с category и images (orderBy sortOrder) | 400 | 500.

import { NextResponse, type NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { imageFileExists, parseProductInput, slugifyName } from "./_shared";

const SORT_ORDERS: Record<string, Prisma.ProductOrderByWithRelationInput[]> = {
  popular: [{ reviewsCount: "desc" }, { rating: "desc" }],
  price_asc: [{ price: "asc" }],
  price_desc: [{ price: "desc" }],
  rating: [{ rating: "desc" }, { reviewsCount: "desc" }],
  new: [{ createdAt: "desc" }],
};

export async function GET(request: NextRequest) {
  try {
    const params = new URL(request.url).searchParams;
    const category = params.get("category");
    const search = (params.get("search") ?? "").trim().toLowerCase();
    const sort = params.get("sort") ?? "popular";
    const featured = params.get("featured") === "1";
    const limitRaw = params.get("limit");
    const limit = limitRaw !== null ? Number.parseInt(limitRaw, 10) : Number.NaN;

    const where: Prisma.ProductWhereInput = {};
    if (category) {
      where.category = { slug: category };
    }
    if (featured) {
      where.featured = true;
    }

    let products = await db.product.findMany({
      where,
      orderBy: SORT_ORDERS[sort] ?? SORT_ORDERS.popular,
      include: { category: { select: { id: true, slug: true, name: true } } },
    });

    if (search) {
      products = products.filter(
        (product) =>
          product.name.toLowerCase().includes(search) ||
          product.description.toLowerCase().includes(search)
      );
    }

    if (Number.isInteger(limit) && limit > 0) {
      products = products.slice(0, limit);
    }

    return NextResponse.json(products);
  } catch (error) {
    console.error("GET /api/products:", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

// POST /api/products — создание товара с валидацией всех полей и генерацией slug
// (транслитерация RU→EN; при занятости — суффиксы -2…-99, иначе 500).
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = parseProductInput(body, { partial: false });
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const data = parsed.data;

    // Категория должна существовать
    const category = await db.category.findUnique({
      where: { id: data.categoryId ?? 0 },
    });
    if (!category) {
      return NextResponse.json({ error: "Категория не найдена" }, { status: 400 });
    }

    // Фотографии: при переданном images проверяем каждый файл, а главное фото
    // выводим из набора; иначе — прежний контракт с обязательным image
    if (data.images) {
      for (const image of data.images) {
        if (!(await imageFileExists(image.url))) {
          return NextResponse.json({ error: "Фото не найдено" }, { status: 400 });
        }
      }
      data.image = data.images.find((image) => image.isMain)?.url ?? data.images[0].url;
    } else if (!data.image || !(await imageFileExists(data.image))) {
      // Файл фото должен существовать в public/images/<products|uploads>
      return NextResponse.json({ error: "Фото не найдено" }, { status: 400 });
    }

    // Уникальный slug: базовый из названия, при занятости — суффиксы -2…-99
    const base = slugifyName(data.name ?? "");
    let slug = "";
    if (!(await db.product.findUnique({ where: { slug: base } }))) {
      slug = base;
    } else {
      for (let suffix = 2; suffix <= 99; suffix += 1) {
        const candidate = `${base}-${suffix}`;
        if (!(await db.product.findUnique({ where: { slug: candidate } }))) {
          slug = candidate;
          break;
        }
      }
    }
    if (!slug) {
      console.error("POST /api/products: не найден свободный slug для:", base);
      return NextResponse.json(
        { error: "Не удалось сгенерировать уникальный адрес товара" },
        { status: 500 }
      );
    }

    // Строки ProductImage: переданный набор images либо единственная запись
    // по старому контракту (image); порядок массива задаёт sortOrder
    const imageRows = (data.images ?? [{ url: data.image ?? "", isMain: true }]).map(
      (image, index) => ({
        url: image.url,
        sortOrder: index,
        isMain: image.isMain,
      })
    );

    const product = await db.product.create({
      data: {
        slug,
        name: data.name ?? "",
        brand: data.brand ?? "КуклаМаркет",
        description: data.description ?? "",
        price: data.price ?? 0,
        oldPrice: data.oldPrice ?? null,
        image: data.image ?? "",
        badge: data.badge ?? null,
        ageMin: data.ageMin ?? 3,
        stock: data.stock ?? 25,
        // Рейтинг и отзывы не задаются вручную из админки: у нового товара их
        // нет (0/0), заполнятся автоматически из реальных отзывов покупателей
        rating: data.rating ?? 0,
        reviewsCount: data.reviewsCount ?? 0,
        featured: data.featured ?? false,
        categoryId: category.id,
        images: { create: imageRows },
      },
      include: {
        category: { select: { id: true, slug: true, name: true } },
        images: { orderBy: { sortOrder: "asc" }, select: { url: true, isMain: true } },
      },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("POST /api/products:", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
