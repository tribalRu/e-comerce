// GET /api/images — список фото для менеджеров изображений (CMS).
// По умолчанию объединяет два каталога: public/images/products и
// public/images/uploads (отсутствующий каталог не ошибка — просто пропускается).
// Параметр ?dir=hero — только постеры баннера из public/images/hero
// (стандартный /images/hero-dolls.png не включается: он лежит в корне images
// и всегда показывается отдельно в редакторе баннера).
// Возвращает JSON-массив отсортированных строк вида "/images/<dir>/<файл>".
// Фильтр по расширению: png / jpg / jpeg / webp / avif / gif (без учёта регистра).

import { NextResponse, type NextRequest } from "next/server";
import { readdir } from "fs/promises";
import path from "path";

const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp|avif|gif)$/i;

// Каталоги с фото (внутри public/images)
const PRODUCT_DIRS = ["products", "uploads"] as const;

export async function GET(request: NextRequest) {
  try {
    const dir = request.nextUrl.searchParams.get("dir");

    // ?dir=hero — только постеры баннера
    const dirs: readonly string[] = dir === "hero" ? ["hero"] : PRODUCT_DIRS;

    const images: string[] = [];

    for (const dirName of dirs) {
      try {
        const entries = await readdir(
          path.join(process.cwd(), "public", "images", dirName),
          { withFileTypes: true }
        );
        for (const entry of entries) {
          if (entry.isFile() && IMAGE_EXTENSIONS.test(entry.name)) {
            images.push(`/images/${dirName}/${entry.name}`);
          }
        }
      } catch {
        // Каталога ещё нет (например, uploads до первой загрузки) — пропускаем
      }
    }

    images.sort();

    return NextResponse.json(images);
  } catch (error) {
    console.error("GET /api/images:", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
