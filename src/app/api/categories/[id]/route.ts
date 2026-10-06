// PUT /api/categories/[id] — правка категории (CMS): { name?, slug?, sort? } —
// все поля опциональны. slug при передаче должен быть свободен (уникален, кроме
// этой же категории). Ответ: 200 { id, slug, name, sort, count } | 400 | 404 | 500.
// DELETE /api/categories/[id] — удаление категории. Запрещено при наличии
// товаров в категории (400: сначала перенесите или удалите их).
// Ответ: 200 { ok: true } | 400 | 404 | 500.

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { validateCategoryName, validateCategorySlug, validateCategorySort } from "../_shared";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const categoryId = /^\d+$/.test(id) ? Number.parseInt(id, 10) : Number.NaN;

    if (!Number.isInteger(categoryId) || categoryId < 1) {
      return NextResponse.json({ error: "Категория не найдена" }, { status: 404 });
    }

    const existing = await db.category.findUnique({ where: { id: categoryId } });
    if (!existing) {
      return NextResponse.json({ error: "Категория не найдена" }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Некорректное тело запроса" }, { status: 400 });
    }
    const raw = body as Record<string, unknown>;

    const data: { name?: string; slug?: string; sort?: number } = {};

    if (raw.name !== undefined) {
      const nameResult = validateCategoryName(raw.name);
      if (!nameResult.ok) {
        return NextResponse.json({ error: nameResult.error }, { status: 400 });
      }
      data.name = nameResult.name;
    }

    if (raw.slug !== undefined) {
      const slugResult = validateCategorySlug(raw.slug);
      if (!slugResult.ok) {
        return NextResponse.json({ error: slugResult.error }, { status: 400 });
      }
      const taken = await db.category.findUnique({ where: { slug: slugResult.slug } });
      if (taken && taken.id !== categoryId) {
        return NextResponse.json(
          { error: `Адрес «${slugResult.slug}» уже занят другой категорией` },
          { status: 400 }
        );
      }
      data.slug = slugResult.slug;
    }

    if (raw.sort !== undefined) {
      const sortResult = validateCategorySort(raw.sort);
      if (!sortResult.ok) {
        return NextResponse.json({ error: sortResult.error }, { status: 400 });
      }
      data.sort = sortResult.sort;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "Нет полей для обновления: передайте name, slug или sort" },
        { status: 400 }
      );
    }

    const category = await db.category.update({
      where: { id: categoryId },
      data,
      include: { _count: { select: { products: true } } },
    });

    return NextResponse.json({
      id: category.id,
      slug: category.slug,
      name: category.name,
      sort: category.sort,
      count: category._count.products,
    });
  } catch (error) {
    console.error("PUT /api/categories/[id]:", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const categoryId = /^\d+$/.test(id) ? Number.parseInt(id, 10) : Number.NaN;

    if (!Number.isInteger(categoryId) || categoryId < 1) {
      return NextResponse.json({ error: "Категория не найдена" }, { status: 404 });
    }

    const category = await db.category.findUnique({
      where: { id: categoryId },
      include: { _count: { select: { products: true } } },
    });
    if (!category) {
      return NextResponse.json({ error: "Категория не найдена" }, { status: 404 });
    }

    // Категорию с товарами удалять нельзя: у Product.categoryId внешний ключ
    if (category._count.products > 0) {
      return NextResponse.json(
        {
          error: `В категории ${category._count.products} ${category._count.products === 1 ? "товар" : "товаров"} — сначала перенесите или удалите их`,
        },
        { status: 400 }
      );
    }

    await db.category.delete({ where: { id: categoryId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/categories/[id]:", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
