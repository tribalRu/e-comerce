// Фотографии категорий: плитки витрины и шапка страницы категории.
// Категориям, созданным в админке без закреплённого снимка, — фолбэк-постер.

export const CATEGORY_TILE_IMAGES: Record<string, string> = {
  fashion: "/images/products/fashion-victoria.png",
  baby: "/images/products/baby-mia.png",
  collectible: "/images/products/collectible-anastasia.png",
  interactive: "/images/products/interactive-sonya.png",
  playsets: "/images/products/playsets-dollhouse.png",
};

const FALLBACK_IMAGE = "/images/hero-dolls.png";

/** Фото категории по слагу (фолбэк — стандартный постер) */
export function categoryTileImage(slug: string): string {
  return CATEGORY_TILE_IMAGES[slug] ?? FALLBACK_IMAGE;
}
