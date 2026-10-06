"use client";

// Сортировка и фильтры страницы категории — тулбар пилюль в стиле Target:
// «Фильтры / Сортировка / Цена / Бренд / Возраст / Рейтинг / Предложения».
// Каждая пилюля открывает поповер с честными фасетными счётчиками; кнопка
// «Фильтры» — общая панель (шит: снизу на мобильном, справа на десктопе),
// первой секцией в ней — навигация по категориям («Все товары» + соседние
// категории со счётчиками): отдельной строки категорий на странице нет.
// Фильтрация и сортировка мгновенные, на клиенте: страница категории уже
// держит все товары категории в памяти, поэтому счётчики не «плывут»
// при комбинировании фильтров, а интерфейс отвечает без перезагрузки.

import { useMemo, useState, type ReactNode } from "react";
import { ArrowUpDown, ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Stars } from "./stars";
import { SORT_OPTIONS, clamp, formatPrice, pluralize } from "./utils";
import type { CategoryWithCount, Product } from "./types";

// ---------------------------------------------------------------------------
// Модель фильтров и движок

export interface CategoryFilters {
  /** Выбранные бренды (пусто — любой бренд) */
  brands: string[];
  /** Выбранные минимальные возрасты ageMin (пусто — любой возраст) */
  ages: number[];
  /** Предложения: «discounted» (есть oldPrice) и/или ключи бейджа hit/new/deal */
  offers: string[];
  /** Минимальный рейтинг (0 — любой) */
  minRating: number;
  /** Границы цены (null — не ограничивать) */
  priceMin: number | null;
  priceMax: number | null;
}

export const EMPTY_CATEGORY_FILTERS: CategoryFilters = {
  brands: [],
  ages: [],
  offers: [],
  minRating: 0,
  priceMin: null,
  priceMax: null,
};

export function isCategoryFiltersActive(filters: CategoryFilters): boolean {
  return (
    filters.brands.length > 0 ||
    filters.ages.length > 0 ||
    filters.offers.length > 0 ||
    filters.minRating > 0 ||
    filters.priceMin != null ||
    filters.priceMax != null
  );
}

/** Отфильтровать товары категории по текущим значениям (внутри группы — ИЛИ) */
export function applyCategoryFilters(
  products: Product[],
  filters: CategoryFilters,
): Product[] {
  return products.filter((product) => {
    if (filters.brands.length > 0 && !filters.brands.includes(product.brand)) return false;
    if (filters.ages.length > 0 && !filters.ages.includes(product.ageMin)) return false;
    if (filters.offers.length > 0 && !matchesOffers(product, filters.offers)) return false;
    if (filters.minRating > 0 && product.rating < filters.minRating) return false;
    if (filters.priceMin != null && product.price < filters.priceMin) return false;
    if (filters.priceMax != null && product.price > filters.priceMax) return false;
    return true;
  });
}

function matchesOffers(product: Product, offers: string[]): boolean {
  return offers.some((offer) =>
    offer === "discounted" ? product.oldPrice != null : product.badge === offer,
  );
}

/** Клиентская реплика SORT_ORDERS из GET /api/products — смена сортировки
 *  не перезагружает список, фильтры и порядок применяются мгновенно */
export function sortCategoryProducts(products: Product[], sort: string): Product[] {
  const copy = [...products];
  copy.sort((a, b) => {
    switch (sort) {
      case "price_asc":
        return a.price - b.price;
      case "price_desc":
        return b.price - a.price;
      case "rating":
        return b.rating - a.rating || b.reviewsCount - a.reviewsCount;
      case "new":
        return createdAtMs(b) - createdAtMs(a) || b.id - a.id;
      default:
        // popular — как в API: по числу отзывов, затем по рейтингу
        return b.reviewsCount - a.reviewsCount || b.rating - a.rating;
    }
  });
  return copy;
}

function createdAtMs(product: Product): number {
  const time = Date.parse(product.createdAt ?? "");
  return Number.isFinite(time) ? time : 0;
}

// ---------------------------------------------------------------------------
// Фасеты: доступные значения и счётчики по всем товарам категории

const OFFER_KEYS = ["discounted", "hit", "new", "deal"] as const;

const OFFER_LABELS: Record<string, string> = {
  discounted: "Со скидкой",
  hit: "Хит продаж",
  new: "Новинка",
  deal: "Выгодная цена",
};

const RATING_OPTIONS = [4.5, 4, 3];

interface Facets {
  total: number;
  brands: { value: string; label: string; count: number }[];
  ages: { value: number; label: string; count: number }[];
  offers: { value: string; label: string; count: number }[];
  ratings: { value: number; count: number }[];
  /** Округлённые до сотен границы цен категории */
  priceMin: number;
  priceMax: number;
}

function buildFacets(products: Product[]): Facets {
  const brands = new Map<string, number>();
  const ages = new Map<number, number>();
  const offers = new Map<string, number>();
  for (const product of products) {
    brands.set(product.brand, (brands.get(product.brand) ?? 0) + 1);
    ages.set(product.ageMin, (ages.get(product.ageMin) ?? 0) + 1);
    if (product.oldPrice != null) {
      offers.set("discounted", (offers.get("discounted") ?? 0) + 1);
    }
    if (product.badge) {
      offers.set(product.badge, (offers.get(product.badge) ?? 0) + 1);
    }
  }
  const prices = products.map((product) => product.price);
  return {
    total: products.length,
    brands: [...brands.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ru"))
      .map(([value, count]) => ({ value, label: value, count })),
    ages: [...ages.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([value, count]) => ({ value, label: ageLabel(value), count })),
    offers: OFFER_KEYS.filter((key) => offers.has(key)).map((key) => ({
      value: key,
      label: OFFER_LABELS[key],
      count: offers.get(key) ?? 0,
    })),
    ratings: RATING_OPTIONS.map((value) => ({
      value,
      count: products.filter((product) => product.rating >= value).length,
    })),
    priceMin: prices.length > 0 ? Math.floor(Math.min(...prices) / 100) * 100 : 0,
    priceMax: prices.length > 0 ? Math.ceil(Math.max(...prices) / 100) * 100 : 0,
  };
}

function ageLabel(age: number): string {
  return `${age}+ ${pluralize(age, "год", "года", "лет")}`;
}

function formatRating(value: number): string {
  return value.toLocaleString("ru-RU");
}

// ---------------------------------------------------------------------------
// Тулбар

interface CategoryFilterBarProps {
  /** Все товары категории (неотфильтрованные) — источник фасетных счётчиков */
  allProducts: Product[];
  /** Категории магазина — навигация в панели «Фильтры» */
  categories: CategoryWithCount[];
  /** Слаг открытой категории (отмечается в списке) */
  currentCategory: string;
  /** Переход на страницу категории; «all» — витрина с полным каталогом */
  onSelectCategory: (slug: string) => void;
  filters: CategoryFilters;
  onFiltersChange: (filters: CategoryFilters) => void;
  sort: string;
  onSortChange: (sort: string) => void;
  /** Сколько товаров видно с текущими фильтрами (для кнопки «Показать N») */
  resultCount: number;
}

export function CategoryFilterBar({
  allProducts,
  categories,
  currentCategory,
  onSelectCategory,
  filters,
  onFiltersChange,
  sort,
  onSortChange,
  resultCount,
}: CategoryFilterBarProps) {
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);
  const facets = useMemo(() => buildFacets(allProducts), [allProducts]);

  // Есть ли товары в категории: сортировка и фасетные группы имеют смысл
  // только с непустым списком, а «Фильтры» (с навигацией по категориям)
  // доступны всегда
  const hasProducts = allProducts.length > 0;
  const totalProducts = categories.reduce((sum, item) => sum + item.count, 0);

  const setFilters = (patch: Partial<CategoryFilters>) =>
    onFiltersChange({ ...filters, ...patch });

  const resetAll = () => onFiltersChange({ ...EMPTY_CATEGORY_FILTERS });

  const toggleBrand = (brand: string) =>
    setFilters({ brands: toggleInList(filters.brands, brand) });
  const toggleAge = (age: number) => setFilters({ ages: toggleInList(filters.ages, age) });
  const toggleOffer = (offer: string) =>
    setFilters({ offers: toggleInList(filters.offers, offer) });

  // Группа имеет смысл, когда выбор реально делит товары категории
  // (вариант покрывает часть, но не весь список)
  const meaningful = (count: number) => count > 0 && count < facets.total;
  const showBrands = facets.brands.some((option) => meaningful(option.count));
  const showAges = facets.ages.some((option) => meaningful(option.count));
  const showOffers = facets.offers.some((option) => meaningful(option.count));
  const showRating = facets.ratings.some((option) => meaningful(option.count));
  const showPrice = new Set(allProducts.map((product) => product.price)).size >= 2;

  // Группа активна — пилюля подсвечивается, показываем число выбранных значений
  const priceActive = filters.priceMin != null || filters.priceMax != null;
  const brandsActive = filters.brands.length > 0;
  const agesActive = filters.ages.length > 0;
  const ratingActive = filters.minRating > 0;
  const offersActive = filters.offers.length > 0;

  // Чипы активных фильтров: каждый можно снять точечно
  const chips: { key: string; group: string; label: string; remove: () => void }[] = [];
  for (const brand of filters.brands) {
    chips.push({
      key: `brand:${brand}`,
      group: "Бренд",
      label: brand,
      remove: () => setFilters({ brands: filters.brands.filter((item) => item !== brand) }),
    });
  }
  for (const age of filters.ages) {
    chips.push({
      key: `age:${age}`,
      group: "Возраст",
      label: ageLabel(age),
      remove: () => setFilters({ ages: filters.ages.filter((item) => item !== age) }),
    });
  }
  for (const offer of filters.offers) {
    chips.push({
      key: `offer:${offer}`,
      group: "Предложения",
      label: OFFER_LABELS[offer] ?? offer,
      remove: () => setFilters({ offers: filters.offers.filter((item) => item !== offer) }),
    });
  }
  if (filters.minRating > 0) {
    chips.push({
      key: "rating",
      group: "Рейтинг",
      label: `Рейтинг от ${formatRating(filters.minRating)}`,
      remove: () => setFilters({ minRating: 0 }),
    });
  }
  if (filters.priceMin != null) {
    chips.push({
      key: "priceMin",
      group: "Цена",
      label: `От ${formatPrice(filters.priceMin)}`,
      remove: () => setFilters({ priceMin: null }),
    });
  }
  if (filters.priceMax != null) {
    chips.push({
      key: "priceMax",
      group: "Цена",
      label: `До ${formatPrice(filters.priceMax)}`,
      remove: () => setFilters({ priceMax: null }),
    });
  }

  // Навигация по категориям — вместо убранной строки чипов: живёт первой
  // секцией в панели «Фильтры». Выбор — это переход (на страницу категории
  // или на витрину для «all»), поэтому радиогруппа, а не чекбоксы-фильтры
  const categorySection = (
    <FilterSection title="Категория" active={false}>
      <RadioGroup value={currentCategory} onValueChange={onSelectCategory} className="gap-0">
        <CategoryRow
          value="all"
          label="Все товары"
          count={totalProducts}
          selected={currentCategory === "all"}
        />
        {categories.map((category) => (
          <CategoryRow
            key={category.slug}
            value={category.slug}
            label={category.name}
            count={category.count}
            selected={category.slug === currentCategory}
          />
        ))}
      </RadioGroup>
    </FilterSection>
  );

  // Секции общие для поповеров и большой панели «Фильтры»
  const priceSection = showPrice ? (
    <FilterSection title="Цена" active={priceActive} onReset={() => setFilters({ priceMin: null, priceMax: null })}>
      <PriceRangeControl facets={facets} filters={filters} onFiltersChange={onFiltersChange} />
    </FilterSection>
  ) : null;

  const brandSection = showBrands ? (
    <FilterSection title="Бренд" active={brandsActive} onReset={() => setFilters({ brands: [] })}>
      <div className="max-h-64 overflow-y-auto">
        {facets.brands.map((option) => (
          <CheckRow
            key={option.value}
            label={option.label}
            count={option.count}
            checked={filters.brands.includes(option.value)}
            onToggle={() => toggleBrand(option.value)}
          />
        ))}
      </div>
    </FilterSection>
  ) : null;

  const ageSection = showAges ? (
    <FilterSection title="Возраст" active={agesActive} onReset={() => setFilters({ ages: [] })}>
      {facets.ages.map((option) => (
        <CheckRow
          key={option.value}
          label={option.label}
          count={option.count}
          checked={filters.ages.includes(option.value)}
          onToggle={() => toggleAge(option.value)}
        />
      ))}
    </FilterSection>
  ) : null;

  const ratingSection = showRating ? (
    <FilterSection title="Рейтинг" active={ratingActive} onReset={() => setFilters({ minRating: 0 })}>
      <RadioGroup
        value={String(filters.minRating)}
        onValueChange={(value) => setFilters({ minRating: Number(value) })}
        className="gap-0"
      >
        <RatingRow value="0" label="Любой" count={facets.total} />
        {facets.ratings
          .filter((option) => option.count > 0)
          .map((option) => (
            <RatingRow
              key={option.value}
              value={String(option.value)}
              label={`от ${formatRating(option.value)}`}
              stars={option.value}
              count={option.count}
            />
          ))}
      </RadioGroup>
    </FilterSection>
  ) : null;

  const offerSection = showOffers ? (
    <FilterSection title="Предложения" active={offersActive} onReset={() => setFilters({ offers: [] })}>
      {facets.offers.map((option) => (
        <CheckRow
          key={option.value}
          label={option.label}
          count={option.count}
          checked={filters.offers.includes(option.value)}
          onToggle={() => toggleOffer(option.value)}
        />
      ))}
    </FilterSection>
  ) : null;

  const sortLabel = SORT_OPTIONS.find((option) => option.value === sort)?.label ?? "Популярные";

  return (
    <div role="group" aria-label="Фильтры и сортировка товаров">
      {/* Ряд пилюль: Фильтры / Сортировка / группы фильтров */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Панель «Фильтры» показываем всегда: внутри — навигация по
            категориям, отдельной строки чипов на странице больше нет */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <button type="button" className={pillClass(chips.length > 0)}>
              <SlidersHorizontal className="size-4 shrink-0" aria-hidden="true" />
              <span>Фильтры</span>
              {chips.length > 0 && <span className={pillBadgeClass}>{chips.length}</span>}
              <ChevronDown className="size-3.5 shrink-0 text-gray-400" aria-hidden="true" />
            </button>
          </SheetTrigger>
          <SheetContent
            side={isMobile ? "bottom" : "right"}
            className={cn("gap-0 p-0", isMobile ? "max-h-[85vh]" : "sm:max-w-md")}
          >
            <SheetHeader className="border-b border-gray-100">
              <SheetTitle className="text-base font-bold text-gray-900">Фильтры</SheetTitle>
              <SheetDescription className="text-xs">
                Смените категорию или подберите куклу по цене, бренду и другим параметрам
              </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 divide-y divide-gray-100 overflow-y-auto px-4">
              {categorySection}
              {priceSection}
              {brandSection}
              {ageSection}
              {ratingSection}
              {offerSection}
            </div>
            <SheetFooter className="flex-row gap-2 border-t border-gray-100">
              <button
                type="button"
                onClick={resetAll}
                disabled={chips.length === 0}
                className="h-11 flex-1 rounded-full border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-40"
              >
                Сбросить всё
              </button>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="h-11 flex-1 rounded-full bg-[#CC0000] px-4 text-sm font-bold text-white transition-colors hover:bg-[#A80000]"
              >
                {hasProducts
                  ? `Показать ${resultCount} ${pluralize(resultCount, "товар", "товара", "товаров")}`
                  : "Готово"}
              </button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        {/* Сортировка имеет смысл, только когда в категории есть товары */}
        {hasProducts && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className={pillClass(sort !== "popular")} aria-label="Сортировка товаров">
                <ArrowUpDown className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">Сортировка: {sortLabel}</span>
                <ChevronDown className="size-3.5 shrink-0 text-gray-400" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60">
              <DropdownMenuRadioGroup value={sort} onValueChange={onSortChange}>
                {SORT_OPTIONS.map((option) => (
                  <DropdownMenuRadioItem key={option.value} value={option.value} className="cursor-pointer">
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {priceSection && (
          <FilterPopover
            label="Цена"
            title="Цена"
            active={priceActive}
            section={priceSection}
          />
        )}
        {brandSection && (
          <FilterPopover
            label="Бренд"
            title="Бренд"
            active={brandsActive}
            badge={filters.brands.length}
            section={brandSection}
          />
        )}
        {ageSection && (
          <FilterPopover
            label="Возраст"
            title="Возраст"
            active={agesActive}
            badge={filters.ages.length}
            section={ageSection}
          />
        )}
        {ratingSection && (
          <FilterPopover
            label="Рейтинг"
            title="Рейтинг"
            active={ratingActive}
            section={ratingSection}
          />
        )}
        {offerSection && (
          <FilterPopover
            label="Предложения"
            title="Предложения"
            active={offersActive}
            badge={filters.offers.length}
            section={offerSection}
          />
        )}
      </div>

      {/* Активные фильтры — чипы с точечным снятием */}
      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.remove}
              aria-label={`Убрать фильтр «${chip.group}: ${chip.label}»`}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#FCE8E8] px-3 text-[13px] font-semibold text-[#CC0000] transition-colors hover:bg-[#FAD9D9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC0000]/30"
            >
              {chip.label}
              <X className="size-3.5 shrink-0" aria-hidden="true" />
            </button>
          ))}
          <button
            type="button"
            onClick={resetAll}
            className="rounded-sm px-1 text-[13px] font-semibold text-[#CC0000] transition-colors hover:text-[#A80000] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC0000]/30"
          >
            Очистить всё
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Переиспользуемые элементы

/** Пилюля-фильтр с поповером: секция группы + кнопка «Готово» */
function FilterPopover({
  label,
  title,
  active,
  badge,
  section,
}: {
  label: string;
  title: string;
  active: boolean;
  badge?: number;
  section: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={pillClass(active)} aria-label={`Фильтр «${title}»`}>
          <span className="truncate">{label}</span>
          {badge != null && badge > 0 && <span className={pillBadgeClass}>{badge}</span>}
          <ChevronDown className="size-3.5 shrink-0 text-gray-400" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <div className="max-h-80 overflow-y-auto">{section}</div>
        <div className="mt-1.5 border-t border-gray-100 pt-2.5">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-9 w-full rounded-full bg-gray-100 px-4 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300"
          >
            Готово
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Секция группы фильтра: заголовок + «Сбросить», когда есть выбор */
function FilterSection({
  title,
  active,
  onReset,
  children,
}: {
  title: string;
  active: boolean;
  /** Сброс группы; у навигационных секций («Категория») сброса нет */
  onReset?: () => void;
  children: ReactNode;
}) {
  return (
    <section className="py-3 first:pt-2 last:pb-1.5">
      <div className="flex items-center justify-between gap-2 px-2">
        <h3 className="text-[13px] font-bold uppercase tracking-wide text-gray-500">{title}</h3>
        {active && (
          <button
            type="button"
            onClick={onReset}
            className="rounded-sm text-xs font-semibold text-[#CC0000] transition-colors hover:text-[#A80000] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC0000]/30"
          >
            Сбросить
          </button>
        )}
      </div>
      <div className="mt-1.5">{children}</div>
    </section>
  );
}

/** Строка-переключатель списка: чекбокс, название, счётчик */
function CheckRow({
  label,
  count,
  checked,
  onToggle,
}: {
  label: string;
  count: number;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-gray-50">
      <Checkbox checked={checked} onCheckedChange={() => onToggle()} aria-label={label} />
      <span className="min-w-0 flex-1 truncate text-sm text-gray-800">{label}</span>
      <span className="shrink-0 text-xs tabular-nums text-gray-400">{count}</span>
    </label>
  );
}

/** Строка выбора рейтинга: радиокнопка, звёзды, счётчик */
function RatingRow({
  value,
  label,
  stars,
  count,
}: {
  value: string;
  label: string;
  stars?: number;
  count: number;
}) {
  return (
    <label className="flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-gray-50">
      <RadioGroupItem value={value} aria-label={stars != null ? `Рейтинг ${label}` : "Любой рейтинг"} />
      {stars != null && <Stars rating={stars} />}
      <span className="min-w-0 flex-1 truncate text-sm text-gray-800">{label}</span>
      <span className="shrink-0 text-xs tabular-nums text-gray-400">{count}</span>
    </label>
  );
}

/** Строка выбора категории: радиокнопка, название, счётчик. Выбор — это
 *  переход на страницу категории («all» — витрина с полным каталогом) */
function CategoryRow({
  value,
  label,
  count,
  selected,
}: {
  value: string;
  label: string;
  count: number;
  selected: boolean;
}) {
  return (
    <label className="flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-gray-50">
      <RadioGroupItem value={value} aria-label={label} />
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-sm",
          selected ? "font-semibold text-gray-900" : "text-gray-800",
        )}
      >
        {label}
      </span>
      <span className="shrink-0 text-xs tabular-nums text-gray-400">{count}</span>
    </label>
  );
}

/** Диапазон цены: ползунок и поля «от/до» с живой фильтрацией */
function PriceRangeControl({
  facets,
  filters,
  onFiltersChange,
}: {
  facets: Facets;
  filters: CategoryFilters;
  onFiltersChange: (filters: CategoryFilters) => void;
}) {
  const from = filters.priceMin ?? facets.priceMin;
  const to = filters.priceMax ?? facets.priceMax;

  // Черновики полей ввода: null — показывать значение из фильтра.
  // Коммит по blur/Enter, чтобы набор числа не дёргал фильтр на каждой цифре
  const [fromDraft, setFromDraft] = useState<string | null>(null);
  const [toDraft, setToDraft] = useState<string | null>(null);
  const shownFrom = fromDraft ?? (filters.priceMin != null ? filters.priceMin.toLocaleString("ru-RU") : "");
  const shownTo = toDraft ?? (filters.priceMax != null ? filters.priceMax.toLocaleString("ru-RU") : "");

  const commit = () => {
    const rawFrom = fromDraft != null ? fromDraft : String(filters.priceMin ?? "");
    const rawTo = toDraft != null ? toDraft : String(filters.priceMax ?? "");
    let nextFrom = parsePriceText(rawFrom, facets);
    let nextTo = parsePriceText(rawTo, facets);
    if (nextFrom != null && nextTo != null && nextFrom > nextTo) {
      [nextFrom, nextTo] = [nextTo, nextFrom];
    }
    onFiltersChange({
      ...filters,
      priceMin: nextFrom === facets.priceMin ? null : nextFrom,
      priceMax: nextTo === facets.priceMax ? null : nextTo,
    });
    setFromDraft(null);
    setToDraft(null);
  };

  return (
    <div className="px-2">
      <div className="flex items-center gap-2.5">
        <Input
          aria-label="Цена от"
          inputMode="numeric"
          placeholder={facets.priceMin.toLocaleString("ru-RU")}
          value={shownFrom}
          onChange={(event) => setFromDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          className="h-9 text-sm"
        />
        <span className="shrink-0 text-sm text-gray-400" aria-hidden="true">
          —
        </span>
        <Input
          aria-label="Цена до"
          inputMode="numeric"
          placeholder={facets.priceMax.toLocaleString("ru-RU")}
          value={shownTo}
          onChange={(event) => setToDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          className="h-9 text-sm"
        />
      </div>
      <Slider
        aria-label="Диапазон цены"
        className="mt-4"
        min={facets.priceMin}
        max={facets.priceMax}
        step={100}
        value={[from, to]}
        onValueChange={(values) => {
          const [nextFrom, nextTo] = values;
          onFiltersChange({
            ...filters,
            priceMin: nextFrom === facets.priceMin ? null : nextFrom,
            priceMax: nextTo === facets.priceMax ? null : nextTo,
          });
        }}
      />
      <p className="mt-2.5 text-xs text-gray-400" aria-live="polite">
        В этой категории: от {formatPrice(facets.priceMin)} до {formatPrice(facets.priceMax)}
      </p>
    </div>
  );
}

/** Разобрать текст поля цены: только цифры, с ограничением по границам */
function parsePriceText(text: string, facets: Facets): number | null {
  const digits = text.replace(/\D/g, "");
  if (!digits) return null;
  return clamp(Number.parseInt(digits, 10), facets.priceMin, facets.priceMax);
}

function toggleInList<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function pillClass(active: boolean) {
  return cn(
    "inline-flex h-10 max-w-full shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC0000]/30",
    active
      ? "border-[#CC0000]/25 bg-[#FCE8E8] text-[#CC0000]"
      : "border-gray-200 bg-white text-gray-800 hover:border-gray-300 hover:bg-gray-50",
  );
}

const pillBadgeClass =
  "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#CC0000] px-1 text-[11px] font-bold leading-none text-white tabular-nums";
