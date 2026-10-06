// Общие типы магазина «КуклаМаркет» (форматы соответствуют API из worklog.md)

export interface CategoryInfo {
  id: number;
  slug: string;
  name: string;
}

export interface CategoryWithCount extends CategoryInfo {
  sort: number;
  count: number;
}

export interface ProductImageInfo {
  url: string;
  isMain: boolean;
}

export interface Product {
  id: number;
  slug: string;
  name: string;
  description: string;
  price: number;
  oldPrice: number | null;
  image: string;
  /** Фотографии галереи (порядок = sortOrder, главная — isMain).
   *  Присутствует в GET /api/products/[id] и ответах POST/PUT; в списке — нет. */
  images?: ProductImageInfo[];
  rating: number;
  reviewsCount: number;
  badge: string | null;
  brand: string;
  ageMin: number;
  stock: number;
  featured: boolean;
  categoryId: number;
  category: CategoryInfo;
  createdAt?: string;
}

export interface CartItem {
  id: string;
  quantity: number;
  product: Product;
}

export interface CartState {
  cartId: string | null;
  items: CartItem[];
  count: number;
  subtotal: number;
}

export interface OrderInfo {
  id: string;
  number: string;
  total: number;
  itemsCount: number;
}

// Настройки сайта (GET/PUT /api/settings): переключатели функционала витрины
// и редактируемые тексты hero-баннера. Управляются в админ-панели /?admin=1.

export interface SiteFeatures {
  aiAssistant: boolean;
  voiceSearch: boolean;
  account: boolean;
  cart: boolean;
}

export interface HeroContent {
  /** Постер баннера: /images/hero-dolls.png (стандартный) или /images/hero/<файл> */
  image: string;
  kicker: string;
  title: string;
  subtitle: string;
  ctaText: string;
}

export interface SiteSettings {
  features: SiteFeatures;
  hero: HeroContent;
}

// Пока настройки не загрузились — считаем, что всё включено (текущее поведение)
export const DEFAULT_SITE_FEATURES: SiteFeatures = {
  aiAssistant: true,
  voiceSearch: true,
  account: true,
  cart: true,
};

export const DEFAULT_HERO_CONTENT: HeroContent = {
  image: "/images/hero-dolls.png",
  kicker: "Неделя кукол",
  title: "Мир кукол со скидками до 40%",
  subtitle: "Модные наряды, уютные домики и фарфоровые коллекционные куклы — всё для игры и восхищения.",
  ctaText: "Смотреть каталог",
};

/** Стандартный постер баннера (кнопка «Сбросить» в админке) */
export const DEFAULT_HERO_IMAGE = "/images/hero-dolls.png";
