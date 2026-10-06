// GET /api/categories — список категорий со счётчиком товаров.
// Контракт (worklog.md): [{ id, slug, name, sort, count }] по sort asc.
//
// POST /api/categories — создание категории (CMS). Тело: { name (обязательно),
// slug?, sort? }. slug без поля генерируется из названия транслитерацией RU→EN
// (slugifyName из products/_shared); при занятости — суффиксы -2…-99; переданный
// slug должен быть свободен (иначе 400). sort по умолчанию — max(sort)+1.
// Ответ: 201 { id, slug, name, sort, count: 0 } | 400 | 500.
//
// PUT /api/categories — порядок категорий на витрине. Тело:
// { order: [id, …] } — перестановка ВСЕХ категорий (каждая ровно один раз);
// sort = позиция в массиве (транзакция). Ответ: 200 — обновлённый список,
// как GET | 400 | 500.

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { slugifyName } from "../products/_shared";
import { validateCategoryName, validateCategorySlug, validateCategorySort } from "./_shared";

export async function GET() {
  try {
    const categories = await db.category.findMany({
      orderBy: { sort: "asc" },
      include: { _count: { select: { products: true } } },
    });

    return NextResponse.json(
      categories.map((category) => ({
        id: category.id,
        slug: category.slug,
        name: category.name,
        sort: category.sort,
        count: category._count.products,
      }))
    );
  } catch (error) {
    console.error("GET /api/categories:", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

// POST /api/categories — создание категории с валидацией и генерацией slug
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Некорректное тело запроса" }, { status: 400 });
    }
    const raw = body as Record<string, unknown>;

    const nameResult = validateCategoryName(raw.name);
    if (!nameResult.ok) {
      return NextResponse.json({ error: nameResult.error }, { status: 400 });
    }

    // slug: переданный — должен быть свободен; иначе генерация с суффиксами
    let slug: string;
    if (raw.slug !== undefined && raw.slug !== null && raw.slug !== "") {
      const slugResult = validateCategorySlug(raw.slug);
      if (!slugResult.ok) {
        return NextResponse.json({ error: slugResult.error }, { status: 400 });
      }
      slug = slugResult.slug;
      if (await db.category.findUnique({ where: { slug } })) {
        return NextResponse.json(
          { error: `Адрес «${slug}» уже занят другой категорией` },
          { status: 400 }
        );
      }
    } else {
      const base = slugifyName(nameResult.name);
      if (!(await db.category.findUnique({ where: { slug: base } }))) {
        slug = base;
      } else {
        slug = "";
        for (let suffix = 2; suffix <= 99; suffix += 1) {
          const candidate = `${base}-${suffix}`;
          if (!(await db.category.findUnique({ where: { slug: candidate } }))) {
            slug = candidate;
            break;
          }
        }
      }
      if (!slug) {
        console.error("POST /api/categories: не найден свободный slug для:", base);
        return NextResponse.json(
          { error: "Не удалось сгенерировать уникальный адрес категории" },
          { status: 500 }
        );
      }
    }

    // sort: переданный или max+1
    let sort: number;
    if (raw.sort !== undefined) {
      const sortResult = validateCategorySort(raw.sort);
      if (!sortResult.ok) {
        return NextResponse.json({ error: sortResult.error }, { status: 400 });
      }
      sort = sortResult.sort;
    } else {
      const last = await db.category.findFirst({
        orderBy: { sort: "desc" },
        select: { sort: true },
      });
      sort = (last?.sort ?? 0) + 1;
    }

    const category = await db.category.create({
      data: { name: nameResult.name, slug, sort },
    });

    return NextResponse.json(
      {
        id: category.id,
        slug: category.slug,
        name: category.name,
        sort: category.sort,
        count: 0,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/categories:", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

// PUT /api/categories — перестановка всех категорий одним запросом
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Некорректное тело запроса" }, { status: 400 });
    }
    const raw = body as Record<string, unknown>;

    if (!Array.isArray(raw.order) || raw.order.length === 0) {
      return NextResponse.json(
        { error: "Поле order должно быть массивом id всех категорий" },
        { status: 400 }
      );
    }
    const order = raw.order;
    if (
      order.some((id) => typeof id !== "number" || !Number.isInteger(id) || id < 1)
    ) {
      return NextResponse.json(
        { error: "order — массив целых id категорий" },
        { status: 400 }
      );
    }

    // Ровно все существующие категории, без повторов
    const existing = await db.category.findMany({ select: { id: true } });
    if (order.length !== existing.length) {
      return NextResponse.json(
        { error: "Передайте порядок всех категорий — включая новые" },
        { status: 400 }
      );
    }
    const seen = new Set<number>();
    for (const id of order) {
      if (seen.has(id)) {
        return NextResponse.json(
          { error: "id в order не должны повторяться" },
          { status: 400 }
        );
      }
      seen.add(id);
    }
    for (const category of existing) {
      if (!seen.has(category.id)) {
        return NextResponse.json(
          { error: "В order должны быть все категории" },
          { status: 400 }
        );
      }
    }

    // sort = позиция (с 1, как в seed); атомарно — транзакция
    await db.$transaction(
      order.map((id, index) =>
        db.category.update({ where: { id }, data: { sort: index + 1 } }),
      ),
    );

    // Обновлённый список — тот же формат, что GET
    const categories = await db.category.findMany({
      orderBy: { sort: "asc" },
      include: { _count: { select: { products: true } } },
    });

    return NextResponse.json(
      categories.map((category) => ({
        id: category.id,
        slug: category.slug,
        name: category.name,
        sort: category.sort,
        count: category._count.products,
      }))
    );
  } catch (error) {
    console.error("PUT /api/categories:", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
