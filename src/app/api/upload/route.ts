// POST /api/upload — загрузка фото товара (менеджер фотографий CMS).
// multipart/form-data, поле "file". Поддерживаемые типы: PNG, JPEG, WebP, AVIF, GIF.
// Размер: 1 байт .. 8 МБ. PNG/JPEG/WebP обрабатываются sharp (при длинной стороне
// > 1800 — ресайз fit: "inside" без увеличения; JPEG/WebP — quality 85), GIF/AVIF
// записываются как есть. Имя файла: <uuid>.<ext>, каталог public/images/uploads.
// Ответ: 201 { url: "/images/uploads/<uuid>.<ext>" } | 400 { error } | 500.

import { NextResponse, type NextRequest } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";

// Максимальный размер загружаемого файла — 8 МБ
const MAX_FILE_SIZE = 8 * 1024 * 1024;

// Предельная длинная сторона фото (сверху — ресайз до 1800 px)
const MAX_SIDE = 1800;

// Соответствие MIME-типа расширению файла
const MIME_TO_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/gif": ".gif",
};

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");

    // Поле "file" обязательно и должно быть файлом
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
    }

    // Поддерживаем только графические форматы
    const ext = MIME_TO_EXT[file.type];
    if (!ext) {
      return NextResponse.json(
        { error: "Поддерживаются форматы PNG, JPEG, WebP, AVIF и GIF" },
        { status: 400 }
      );
    }

    // Размер: не пустой и не больше 8 МБ
    if (file.size === 0) {
      return NextResponse.json({ error: "Пустой файл" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Файл больше 8 МБ" }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const filename = `${randomUUID()}${ext}`;
    const uploadsDir = path.join(process.cwd(), "public", "images", "uploads");
    // Каталог создаётся при необходимости (первая загрузка)
    await mkdir(uploadsDir, { recursive: true });
    const filePath = path.join(uploadsDir, filename);

    if (
      file.type === "image/png" ||
      file.type === "image/jpeg" ||
      file.type === "image/webp"
    ) {
      // PNG/JPEG/WebP: метаданные → при длинной стороне > 1800 уменьшаем,
      // затем перекодируем (JPEG/WebP — quality 85)
      let output: Buffer;
      try {
        const image = sharp(bytes);
        const metadata = await image.metadata();
        const longestSide = Math.max(metadata.width ?? 0, metadata.height ?? 0);
        if (longestSide > MAX_SIDE) {
          image.resize({
            width: MAX_SIDE,
            height: MAX_SIDE,
            fit: "inside",
            withoutEnlargement: true,
          });
        }
        if (file.type === "image/png") {
          output = await image.png().toBuffer();
        } else if (file.type === "image/jpeg") {
          output = await image.jpeg({ quality: 85 }).toBuffer();
        } else {
          output = await image.webp({ quality: 85 }).toBuffer();
        }
      } catch (imageError) {
        // Битый файл или другая ошибка обработки изображения
        console.error("POST /api/upload: ошибка обработки изображения:", imageError);
        return NextResponse.json(
          { error: "Не удалось обработать изображение" },
          { status: 400 }
        );
      }
      await writeFile(filePath, output);
    } else {
      // GIF/AVIF: записываем исходные байты без обработки
      await writeFile(filePath, bytes);
    }

    return NextResponse.json({ url: `/images/uploads/${filename}` }, { status: 201 });
  } catch (error) {
    console.error("POST /api/upload:", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
