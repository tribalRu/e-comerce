// Хелперы магазина: цены, склонения, бейджи

export const FREE_DELIVERY_FROM = 3000;

export function formatPrice(value: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
}

export function pluralize(n: number, one: string, few: string, many: string): string {
  const mod10 = Math.abs(n) % 10;
  const mod100 = Math.abs(n) % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export const BADGE_LABELS: Record<string, string> = {
  hit: "Хит продаж",
  new: "Новинка",
  sale: "Скидка",
  deal: "Выгодная цена",
};

// Варианты сортировки каталога (витрина и страницы категорий);
// значения соответствуют GET /api/products?sort=
export const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "popular", label: "Популярные" },
  { value: "price_asc", label: "Сначала дешевле" },
  { value: "price_desc", label: "Сначала дороже" },
  { value: "rating", label: "Высокий рейтинг" },
  { value: "new", label: "Новинки" },
];
