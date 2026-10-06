// Общая валидация полей категории для POST /api/categories и
// PUT /api/categories[/id]. Не является route handler (файлы с префиксом "_"
// исключены из роутинга).

/** Допустимый slug категории: строчные латиница/цифры группами через дефис */
export const CATEGORY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type NameResult = { ok: true; name: string } | { ok: false; error: string };

/** name: строка, непустая после trim, до 60 символов */
export function validateCategoryName(raw: unknown): NameResult {
  if (typeof raw !== "string") {
    return { ok: false, error: "Название категории должно быть строкой" };
  }
  const name = raw.trim();
  if (name.length === 0) {
    return { ok: false, error: "Название категории не может быть пустым" };
  }
  if (name.length > 60) {
    return { ok: false, error: "Название категории не длиннее 60 символов" };
  }
  return { ok: true, name };
}

export type SlugResult = { ok: true; slug: string } | { ok: false; error: string };

/** slug: строка, непустая после trim, до 60 символов, только a-z0-9 и дефисы */
export function validateCategorySlug(raw: unknown): SlugResult {
  if (typeof raw !== "string") {
    return { ok: false, error: "Адрес категории должен быть строкой" };
  }
  const slug = raw.trim().toLowerCase();
  if (slug.length === 0) {
    return { ok: false, error: "Адрес категории не может быть пустым" };
  }
  if (slug.length > 60) {
    return { ok: false, error: "Адрес категории не длиннее 60 символов" };
  }
  if (!CATEGORY_SLUG_PATTERN.test(slug)) {
    return {
      ok: false,
      error: "Адрес категории: только строчные латинские буквы, цифры и дефисы — например, kollektsionnye",
    };
  }
  return { ok: true, slug };
}

export type SortResult = { ok: true; sort: number } | { ok: false; error: string };

/** sort: целое число 0..999 */
export function validateCategorySort(raw: unknown): SortResult {
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0 || raw > 999) {
    return { ok: false, error: "Порядок категории должен быть целым числом от 0 до 999" };
  }
  return { ok: true, sort: raw };
}
