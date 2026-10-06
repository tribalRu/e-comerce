"use client";

// Отдельная страница категории (виртуальный роут /?category=<slug>):
// хлебные крошки, шапка с фотографией и счётчиком, тулбар фильтров
// и сортировки (category-filters.tsx) и сетка товаров. Отдельной строки
// категорий здесь нет: переход между категориями — через основное меню
// шапки или секцию «Категория» в панели «Фильтры». Это самостоятельная
// страница каталога, а не витрина с фильтром: без главного баннера, плиток
// и хитов продаж. Товары категории загружаются один раз, дальше фильтры
// и сортировка применяются мгновенно на клиенте.

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { SearchX } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CategoryFilterBar,
  EMPTY_CATEGORY_FILTERS,
  applyCategoryFilters,
  isCategoryFiltersActive,
  sortCategoryProducts,
  type CategoryFilters,
} from "./category-filters";
import { categoryTileImage } from "./category-images";
import { ProductCard } from "./product-card";
import { pluralize } from "./utils";
import type { CategoryWithCount, Product } from "./types";

interface CategoryPageProps {
  slug: string;
  categories: CategoryWithCount[];
  /** true, когда список категорий загружен (до этого «не найдено» не показываем) */
  categoriesReady: boolean;
  cartEnabled: boolean;
  onQuickAdd: (product: Product) => void;
  onOpenProduct: (product: Product) => void;
  /** Перейти на страницу другой категории */
  onSelectCategory: (slug: string) => void;
  onGoHome: () => void;
  /** «Все товары»: вернуться на витрину, к секции каталога */
  onGoCatalog: () => void;
}

export function CategoryPage({
  slug,
  categories,
  categoriesReady,
  cartEnabled,
  onQuickAdd,
  onOpenProduct,
  onSelectCategory,
  onGoHome,
  onGoCatalog,
}: CategoryPageProps) {
  // Все товары категории — загружаются один раз; фильтры и сортировка
  // применяются на клиенте мгновенно, без перезагрузки списка
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("popular");
  const [filters, setFilters] = useState<CategoryFilters>({ ...EMPTY_CATEGORY_FILTERS });

  // Товары категории; при смене категории компонент перемонтируется (key=slug).
  // loading=true ставится только в инициализации (не в effect)
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/products?category=${encodeURIComponent(slug)}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("bad response"))))
      .then((data: Product[]) => {
        setAllProducts(data);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoading(false);
      });
    return () => controller.abort();
  }, [slug]);

  // Отфильтрованный и отсортированный список — единый источник для сетки
  // и счётчика «Показано N из M»
  const visibleProducts = useMemo(
    () => sortCategoryProducts(applyCategoryFilters(allProducts, filters), sort),
    [allProducts, filters, sort],
  );

  const info = categories.find((item) => item.slug === slug);
  const categoryName = info?.name ?? "Категория";

  // Неизвестный слаг — честная страница «не найдено» (когда список точно загружен)
  if (categoriesReady && !info) {
    return (
      <div className="shop-container flex flex-col items-center gap-3 py-24 text-center">
        <SearchX className="size-12 text-gray-300" aria-hidden="true" />
        <h1 className="text-lg font-bold text-gray-900">Категория не найдена</h1>
        <p className="max-w-xs text-sm text-gray-500">
          Такой категории больше нет — возможно, её удалили из магазина.
        </p>
        <button
          type="button"
          onClick={onGoHome}
          className="mt-1 rounded-full bg-[#CC0000] px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#A80000]"
        >
          На главную
        </button>
      </div>
    );
  }

  const breadcrumbClass =
    "rounded-sm font-medium transition-colors hover:text-[#CC0000] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC0000]/30";

  return (
    <div className="shop-container pb-2 pt-6 sm:pt-8">
      {/* Хлебные крошки: Главная / Каталог / <Категория> */}
      <nav
        aria-label="Хлебные крошки"
        className="flex flex-wrap items-center gap-1.5 text-sm text-gray-500"
      >
        <button type="button" onClick={onGoHome} className={breadcrumbClass}>
          Главная
        </button>
        <span aria-hidden="true">/</span>
        <button type="button" onClick={onGoCatalog} className={breadcrumbClass}>
          Каталог
        </button>
        <span aria-hidden="true">/</span>
        <span aria-current="page" className="font-semibold text-gray-900">
          {categoryName}
        </span>
      </nav>

      {/* Шапка категории: название, счётчик, фотография */}
      <div className="mt-4 flex items-center justify-between gap-5">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="block h-8 w-1.5 shrink-0 rounded-full bg-[#CC0000]" aria-hidden="true" />
            <h1 className="truncate text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
              {categoryName}
            </h1>
          </div>
          <p className="mt-2 text-sm text-gray-500" aria-live="polite">
            {loading
              ? "Загружаем товары…"
              : isCategoryFiltersActive(filters)
                ? `Показано ${visibleProducts.length} из ${allProducts.length} ${pluralize(allProducts.length, "товара", "товаров", "товаров")}`
                : `${allProducts.length} ${pluralize(allProducts.length, "товар", "товара", "товаров")} в категории`}
          </p>
        </div>
        <span className="block shrink-0 overflow-hidden rounded-2xl ring-1 ring-gray-200">
          <Image
            src={categoryTileImage(slug)}
            alt={`Категория «${categoryName}»`}
            width={144}
            height={144}
            unoptimized
            className="size-20 object-cover sm:size-28 lg:size-32"
          />
        </span>
      </div>

      {/* Тулбар фильтров и сортировки: панель «Фильтры» (внутри — навигация
          по категориям) доступна всегда, сортировка и группы фильтров —
          когда в категории есть товары */}
      {!loading && (
        <div className="mt-6">
          <CategoryFilterBar
            allProducts={allProducts}
            categories={categories}
            currentCategory={slug}
            onSelectCategory={onSelectCategory}
            filters={filters}
            onFiltersChange={setFilters}
            sort={sort}
            onSortChange={setSort}
            resultCount={visibleProducts.length}
          />
        </div>
      )}

      {/* Товары категории */}
      {loading ? (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }, (_, index) => (
            <div key={index} className="space-y-2.5">
              <Skeleton className="aspect-square rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-5 w-1/2" />
            </div>
          ))}
        </div>
      ) : allProducts.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-300 py-16 text-center">
          <p className="text-base font-bold text-gray-900">В этой категории пока пусто</p>
          <p className="max-w-xs text-sm text-gray-500">
            Загляните в соседние категории или вернитесь к полному каталогу.
          </p>
          <button
            type="button"
            onClick={onGoCatalog}
            className="mt-1 rounded-full bg-[#CC0000] px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#A80000]"
          >
            Все товары
          </button>
        </div>
      ) : visibleProducts.length === 0 ? (
        // Фильтры отсеяли всё: честное «ничего не подошло» со сбросом
        <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-300 py-16 text-center">
          <SearchX className="size-12 text-gray-300" aria-hidden="true" />
          <p className="text-base font-bold text-gray-900">Под фильтры ничего не подошло</p>
          <p className="max-w-xs text-sm text-gray-500">
            В этой категории есть {allProducts.length}{" "}
            {pluralize(allProducts.length, "товар", "товара", "товаров")} — попробуйте расширить
            цену или убрать часть параметров.
          </p>
          <button
            type="button"
            onClick={() => setFilters({ ...EMPTY_CATEGORY_FILTERS })}
            className="mt-1 rounded-full bg-[#CC0000] px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#A80000]"
          >
            Сбросить фильтры
          </button>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visibleProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onOpen={onOpenProduct}
              onAdd={onQuickAdd}
              canAdd={cartEnabled}
            />
          ))}
        </div>
      )}
    </div>
  );
}
