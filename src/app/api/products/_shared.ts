// Общая валидация полей товара для POST /api/products и PUT /api/products/[id].
// Не является route handler (файлы с префиксом "_" исключены из роутинга).

import { stat } from "fs/promises";
import path from "path";

// Допустимые метки товара (контракт worklog.md: hit | new | sale | deal)
export const PRODUCT_BADGES = ["hit", "new", "sale", "deal"] as const;

// Регулярка пути фото (контракт: /images/products/<имя> или /images/uploads/<имя>)
const IMAGE_PATTERN = /^\/images\/(products|uploads)\/[A-Za-z0-9._-]+$/;

// Транслитерация кириллицы для генерации slug (RU → EN)
const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i",
  й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
  у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "",
  э: "e", ю: "yu", я: "ya",
};

// slug из названия: транслитерация → нижний регистр → не-буквоцифры в "-",
// повторы "-" схлопываются, края обрезаются; пустой результат → "tovar"
export function slugifyName(name: string): string {
  const slug = name
    .toLowerCase()
    .split("")
    .map((char) => (TRANSLIT[char] !== undefined ? TRANSLIT[char] : char))
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "tovar";
}

// Проверяет, что файл фото существует в public/images/products или
// public/images/uploads (каталог определяется по префиксу url) и это именно файл
export async function imageFileExists(image: string): Promise<boolean> {
  try {
    const dir = image.startsWith("/images/uploads/") ? "uploads" : "products";
    const info = await stat(
      path.join(
        process.cwd(),
        "public",
        "images",
        dir,
        image.slice(`/images/${dir}/`.length)
      )
    );
    return info.isFile();
  } catch {
    return false;
  }
}

// Распознанные поля товара — готовы для передачи в Prisma create/update.
// images — набор фотографий галереи (менеджер фотографий CMS): порядок массива
// задаёт sortOrder, ровно одна запись помечена isMain (при отсутствии — первая)
export type ProductInputData = {
  name?: string;
  brand?: string;
  description?: string;
  price?: number;
  oldPrice?: number | null;
  image?: string;
  badge?: string | null;
  ageMin?: number;
  stock?: number;
  rating?: number;
  reviewsCount?: number;
  featured?: boolean;
  categoryId?: number;
  images?: { url: string; isMain: boolean }[];
};

// Результат валидации: либо данные, либо текст ошибки (роут вернёт 400)
export type ParseResult =
  | { ok: true; data: ProductInputData }
  | { ok: false; error: string };

// Валидация тела запроса. partial=false (POST): name/description/price/image/categoryId
// обязательны. partial=true (PUT): валидируются только переданные поля, slug не меняется.
// currentPrice — текущая цена товара (в PUT нужна для проверки oldPrice против цены).
export function parseProductInput(
  body: unknown,
  options: { partial: boolean; currentPrice?: number }
): ParseResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "Некорректное тело запроса" };
  }

  const raw = body as Record<string, unknown>;
  const data: ProductInputData = {};
  const has = (key: string) => raw[key] !== undefined;

  // name: обязательно в POST; trim, 1..200 символов
  if (!options.partial || has("name")) {
    if (typeof raw.name !== "string") {
      return { ok: false, error: "Название товара обязательно" };
    }
    const name = raw.name.trim();
    if (name.length === 0) {
      return { ok: false, error: "Название товара не может быть пустым" };
    }
    if (name.length > 200) {
      return { ok: false, error: "Название товара не длиннее 200 символов" };
    }
    data.name = name;
  }

  // brand: опционально (дефолт "КуклаМаркет" применяется при создании); trim, 1..80
  if (has("brand")) {
    if (typeof raw.brand !== "string") {
      return { ok: false, error: "Бренд должен быть строкой" };
    }
    const brand = raw.brand.trim();
    if (brand.length === 0) {
      return { ok: false, error: "Бренд не может быть пустым" };
    }
    if (brand.length > 80) {
      return { ok: false, error: "Бренд не длиннее 80 символов" };
    }
    data.brand = brand;
  }

  // description: обязательно в POST; trim, 1..2000 символов
  if (!options.partial || has("description")) {
    if (typeof raw.description !== "string") {
      return { ok: false, error: "Описание товара обязательно" };
    }
    const description = raw.description.trim();
    if (description.length === 0) {
      return { ok: false, error: "Описание товара не может быть пустым" };
    }
    if (description.length > 2000) {
      return { ok: false, error: "Описание товара не длиннее 2000 символов" };
    }
    data.description = description;
  }

  // price: обязательно в POST; целое 1..10 000 000
  if (!options.partial || has("price")) {
    if (
      typeof raw.price !== "number" ||
      !Number.isInteger(raw.price) ||
      raw.price < 1 ||
      raw.price > 10_000_000
    ) {
      return { ok: false, error: "Цена должна быть целым числом от 1 до 10 000 000" };
    }
    data.price = raw.price;
  }

  // oldPrice: null/отсутствует ИЛИ целое; при указании — строго больше цены
  // (в POST — новой, в PUT — новой при передаче, иначе текущей)
  if (has("oldPrice")) {
    if (raw.oldPrice === null) {
      data.oldPrice = null;
    } else {
      if (typeof raw.oldPrice !== "number" || !Number.isInteger(raw.oldPrice)) {
        return { ok: false, error: "Старая цена должна быть целым числом" };
      }
      const price = data.price ?? options.currentPrice;
      if (price !== undefined && raw.oldPrice <= price) {
        return { ok: false, error: "Старая цена должна быть больше текущей" };
      }
      data.oldPrice = raw.oldPrice;
    }
  }

  // categoryId: обязательно в POST; целое ≥ 1 (существование проверяет роут)
  if (!options.partial || has("categoryId")) {
    if (
      typeof raw.categoryId !== "number" ||
      !Number.isInteger(raw.categoryId) ||
      raw.categoryId < 1
    ) {
      return { ok: false, error: "Категория не найдена" };
    }
    data.categoryId = raw.categoryId;
  }

  // badge: null/отсутствует ИЛИ один из hit|new|sale|deal
  if (has("badge")) {
    if (raw.badge === null) {
      data.badge = null;
    } else if (
      typeof raw.badge !== "string" ||
      !(PRODUCT_BADGES as readonly string[]).includes(raw.badge)
    ) {
      return { ok: false, error: "Метка товара может быть hit, new, sale или deal" };
    } else {
      data.badge = raw.badge;
    }
  }

  // images: массив фотографий галереи (контракт Task 12) — 1..12 записей
  // { url, isMain? }; порядок массива = порядок галереи (sortOrder);
  // url — строки без дублей по IMAGE_PATTERN (файл проверяет роут);
  // isMain — boolean, максимум у одной; если ни у одной — первой становится первая
  if (has("images")) {
    if (!Array.isArray(raw.images)) {
      return { ok: false, error: "Добавьте хотя бы одно фото товара" };
    }
    if (raw.images.length === 0) {
      return { ok: false, error: "Добавьте хотя бы одно фото товара" };
    }
    if (raw.images.length > 12) {
      return { ok: false, error: "Не больше 12 фотографий" };
    }
    const images: { url: string; isMain: boolean }[] = [];
    const seenUrls = new Set<string>();
    let mainCount = 0;
    for (const item of raw.images) {
      if (typeof item !== "object" || item === null || Array.isArray(item)) {
        return { ok: false, error: "Некорректный список фотографий" };
      }
      const entry = item as Record<string, unknown>;
      if (typeof entry.url !== "string" || !IMAGE_PATTERN.test(entry.url)) {
        return { ok: false, error: "Фото не найдено" };
      }
      if (seenUrls.has(entry.url)) {
        return { ok: false, error: "Фотографии не должны повторяться" };
      }
      seenUrls.add(entry.url);
      let isMain = false;
      if (entry.isMain !== undefined) {
        if (typeof entry.isMain !== "boolean") {
          return { ok: false, error: "Некорректный флаг главной фотографии" };
        }
        isMain = entry.isMain;
      }
      if (isMain) {
        mainCount += 1;
      }
      images.push({ url: entry.url, isMain });
    }
    if (mainCount > 1) {
      return { ok: false, error: "Главная фотография может быть только одна" };
    }
    if (mainCount === 0) {
      // Главная не указана — главной становится первая фотография
      images[0].isMain = true;
    }
    data.images = images;
  }

  // image: обязательно в POST, если не передан images (тогда image игнорируется
  // и выводится из набора); путь вида /images/<products|uploads>/<файл>
  // (файл проверяет роут)
  if (!options.partial || has("image")) {
    if (data.images === undefined) {
      if (typeof raw.image !== "string" || !IMAGE_PATTERN.test(raw.image)) {
        return { ok: false, error: "Фото не найдено" };
      }
      data.image = raw.image;
    }
  }

  // stock: целое 0..100 000 (дефолт 25 применяется при создании)
  if (has("stock")) {
    if (
      typeof raw.stock !== "number" ||
      !Number.isInteger(raw.stock) ||
      raw.stock < 0 ||
      raw.stock > 100_000
    ) {
      return { ok: false, error: "Остаток должен быть целым числом от 0 до 100 000" };
    }
    data.stock = raw.stock;
  }

  // ageMin: целое 0..18 (дефолт 3 применяется при создании)
  if (has("ageMin")) {
    if (
      typeof raw.ageMin !== "number" ||
      !Number.isInteger(raw.ageMin) ||
      raw.ageMin < 0 ||
      raw.ageMin > 18
    ) {
      return { ok: false, error: "Минимальный возраст должен быть целым числом от 0 до 18" };
    }
    data.ageMin = raw.ageMin;
  }

  // rating: число 0..5, округление до 1 знака (при создании без поля — 0:
  // будет рассчитываться автоматически из реальных отзывов покупателей)
  if (has("rating")) {
    if (
      typeof raw.rating !== "number" ||
      !Number.isFinite(raw.rating) ||
      raw.rating < 0 ||
      raw.rating > 5
    ) {
      return { ok: false, error: "Рейтинг должен быть числом от 0 до 5" };
    }
    data.rating = Math.round(raw.rating * 10) / 10;
  }

  // reviewsCount: целое 0..1 000 000 (дефолт 0 при создании — из реальных
  // отзывов; вручную из админки не редактируется)
  if (has("reviewsCount")) {
    if (
      typeof raw.reviewsCount !== "number" ||
      !Number.isInteger(raw.reviewsCount) ||
      raw.reviewsCount < 0 ||
      raw.reviewsCount > 1_000_000
    ) {
      return { ok: false, error: "Число отзывов должно быть целым числом от 0 до 1 000 000" };
    }
    data.reviewsCount = raw.reviewsCount;
  }

  // featured: boolean (дефолт false применяется при создании)
  if (has("featured")) {
    if (typeof raw.featured !== "boolean") {
      return { ok: false, error: "Поле featured должно быть true или false" };
    }
    data.featured = raw.featured;
  }

  return { ok: true, data };
}
