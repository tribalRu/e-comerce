"use client";

// КуклаМаркет — единый пользовательский роут `/` (ограничение песочницы):
// без параметров — витрина (hero → категории → хиты → каталог → футер),
// с ?product=<id> — страница товара, с ?category=<slug> — отдельная
// страница категории (хлебные крошки, шапка категории, её товары).
// Виртуальные переходы меняют URL, работают «Назад»/«Вперёд» браузера —
// ощущение настоящих страниц сайта.

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchX, X } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

import { AddedToCartDrawer } from "@/components/shop/added-to-cart";
import { AdminPanel } from "@/components/shop/admin/admin-panel";
import { CartDrawer } from "@/components/shop/cart-drawer";
import { CategoryPage } from "@/components/shop/category-page";
import { CategoryTiles } from "@/components/shop/category-tiles";
import { CheckoutDialog } from "@/components/shop/checkout-dialog";
import { Footer } from "@/components/shop/footer";
import { Header } from "@/components/shop/header";
import { Hero } from "@/components/shop/hero";
import { ProductCard } from "@/components/shop/product-card";
import { ProductPage } from "@/components/shop/product-page";
import { SectionHeader } from "@/components/shop/section-header";
import { useCart } from "@/components/shop/use-cart";
import { SORT_OPTIONS, pluralize } from "@/components/shop/utils";
import { DEFAULT_HERO_CONTENT, DEFAULT_SITE_FEATURES } from "@/components/shop/types";
import type { CategoryWithCount, Product, SiteSettings } from "@/components/shop/types";

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" aria-hidden="true" />}>
      <Storefront />
    </Suspense>
  );
}

function Storefront() {
  const { toast } = useToast();
  const cart = useCart();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Виртуальные роуты на единственном URL `/`:
  //   /?admin=1            — админ-панель управления магазином (CMS + функционал)
  //   /?admin=1&edit=new   — отдельная страница создания товара (CMS)
  //   /?admin=1&edit=<id>  — отдельная страница редактирования товара (CMS)
  //   /?product=<id>       — страница товара (приоритетнее категории)
  //   /?category=<slug>    — отдельная страница категории каталога
  const isAdmin = searchParams.get("admin") === "1";
  const adminEdit = isAdmin ? parseAdminEdit(searchParams.get("edit")) : null;
  const routeProductId = isAdmin ? null : parseProductId(searchParams.get("product"));
  const routeCategory =
    isAdmin || routeProductId != null ? null : parseCategorySlug(searchParams.get("category"));

  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  // Список категорий загружен (странице категории нужно для «не найдено»)
  const [categoriesReady, setCategoriesReady] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [featured, setFeatured] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sort, setSort] = useState("popular");
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [addedProduct, setAddedProduct] = useState<Product | null>(null);
  const [addedQuantity, setAddedQuantity] = useState(1);
  const [addedOpen, setAddedOpen] = useState(false);
  // Секция, к которой нужно проскроллиться после возврата из карточки товара
  const [pendingSection, setPendingSection] = useState<string | null>(null);

  // Настройки сайта из админки: функционал (корзина, ИИ, кабинет, голосовой
  // поиск) + тексты hero-баннера. Пока не загрузились — дефолты (всё включено)
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);

  // Данные витрины (категории, хиты) — не запрашиваем в режиме админки;
  // после возврата из неё (isAdmin стал false) — перечитываем: там могли
  // изменить товары или хиты продаж
  useEffect(() => {
    if (isAdmin) return;
    fetch("/api/categories")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data: CategoryWithCount[]) => {
        setCategories(data);
        setCategoriesReady(true);
      })
      .catch(() => {});
    fetch("/api/products?featured=1&sort=popular")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data: Product[]) => setFeatured(data))
      .catch(() => {});
  }, [isAdmin]);

  // Настройки сайта: при первом входе и после каждого возврата из админ-панели
  // (там могли выключить корзину/ИИ или поменять баннер)
  useEffect(() => {
    if (isAdmin) return;
    fetch("/api/settings")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data: SiteSettings) => setSiteSettings(data))
      .catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ sort });
      if (category !== "all") params.set("category", category);
      if (search) params.set("search", search);
      fetch(`/api/products?${params.toString()}`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error("bad response"))))
        .then((data: Product[]) => {
          setProducts(data);
          setLoading(false);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setLoading(false);
        });
    }, 150);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [category, search, sort, isAdmin]);

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Возврат в каталог: проскроллиться к секции (поиск/категория/акции) после рендера
  useEffect(() => {
    if (routeProductId == null && routeCategory == null && pendingSection) {
      const sectionId = pendingSection;
      const timer = setTimeout(() => {
        setPendingSection(null);
        scrollTo(sectionId);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [routeProductId, routeCategory, pendingSection, scrollTo]);

  // Перейти к секции каталога; если открыта карточка товара или страница
  // категории — сначала вернуться на витрину
  const goCatalog = useCallback(
    (section: string) => {
      if (routeProductId != null || routeCategory != null) {
        setPendingSection(section);
        router.push("/");
      } else {
        scrollTo(section);
      }
    },
    [routeProductId, routeCategory, router, scrollTo],
  );

  // Открыть карточку товара «на другой странице» в этом же окне
  const openProduct = useCallback(
    (product: Product) => {
      router.push(`/?product=${product.id}`);
    },
    [router],
  );

  // Вернуться на витрину (лого, хлебные крошки «Главная», «Товар не найден»)
  const goHome = useCallback(() => {
    if (routeProductId != null || routeCategory != null) {
      router.push("/");
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [routeProductId, routeCategory, router]);

  // Категория из плиток, меню шапки, футера и карточки товара — переход на
  // её отдельную страницу /?category=<slug>; «all» — витрина с каталогом
  const handleSelectCategory = useCallback(
    (slug: string) => {
      if (slug === "all") {
        setCategory("all");
        setPendingSection("catalog");
        router.push("/");
      } else {
        router.push(`/?category=${slug}`);
      }
    },
    [router],
  );

  const handleSubmitSearch = useCallback(
    (query: string) => {
      const trimmed = query.trim();
      setSearch(trimmed);
      setSearchInput(trimmed);
      goCatalog("catalog");
    },
    [goCatalog],
  );

  const clearSearch = useCallback(() => {
    setSearch("");
    setSearchInput("");
  }, []);

  const handleAdd = useCallback(
    async (product: Product, quantity = 1) => {
      const ok = await cart.addToCart(product.id, quantity);
      if (ok) {
        // Успех показываем боковой выезжающей панелью «Добавлено в корзину» (как у Target)
        setAddedProduct(product);
        setAddedQuantity(quantity);
        setAddedOpen(true);
      } else {
        toast({
          title: "Не получилось",
          description: "Товар не добавлен — попробуйте ещё раз",
          variant: "destructive",
        });
      }
    },
    [cart, toast],
  );

  const handleQuickAdd = useCallback(
    (product: Product) => {
      void handleAdd(product, 1);
    },
    [handleAdd],
  );

  const totalProducts = categories.reduce((sum, item) => sum + item.count, 0);
  const activeCategoryName =
    category === "all" ? null : (categories.find((item) => item.slug === category)?.name ?? null);
  const features = siteSettings?.features ?? DEFAULT_SITE_FEATURES;
  const heroContent = siteSettings?.hero ?? DEFAULT_HERO_CONTENT;

  // Админ-панель — полноэкранный режим на том же роуте (шапка и футер свои);
  // editTarget открывает отдельную страницу создания/редактирования товара
  if (isAdmin) {
    return <AdminPanel editTarget={adminEdit} onExit={() => router.push("/")} />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header
        features={features}
        categories={categories}
        activeCategory={routeCategory ?? category}
        onSelectCategory={handleSelectCategory}
        cartCount={cart.count}
        onOpenCart={() => setCartOpen(true)}
        searchInput={searchInput}
        onSearchInputChange={setSearchInput}
        onSubmitSearch={handleSubmitSearch}
        onGoDeals={() => goCatalog("deals")}
        onGoHome={goHome}
      />

      <main className="flex-1">
        {routeProductId != null ? (
          <ProductPage
            key={routeProductId}
            productId={routeProductId}
            cartEnabled={features.cart}
            onAdd={(product, quantity) => void handleAdd(product, quantity)}
            onQuickAdd={handleQuickAdd}
            onOpenProduct={openProduct}
            onGoCategory={handleSelectCategory}
            onGoHome={goHome}
          />
        ) : routeCategory != null ? (
          <CategoryPage
            key={routeCategory}
            slug={routeCategory}
            categories={categories}
            categoriesReady={categoriesReady}
            cartEnabled={features.cart}
            onQuickAdd={handleQuickAdd}
            onOpenProduct={openProduct}
            onSelectCategory={handleSelectCategory}
            onGoHome={goHome}
            onGoCatalog={() => goCatalog("catalog")}
          />
        ) : (
          <>
            <Hero onShopNow={() => scrollTo("catalog")} content={heroContent} />

            <CategoryTiles
              categories={categories}
              activeCategory={category}
              onSelectCategory={handleSelectCategory}
            />

            <section id="deals" className="shop-container scroll-mt-32 pt-10" aria-label="Хиты продаж">
              <SectionHeader
                title="Хиты продаж"
                subtitle="Любимцы покупателей — проверены тысячами маленьких хозяек"
              />
              <Carousel opts={{ align: "start", slidesToScroll: 2 }} className="mt-5">
                <CarouselContent className="-ml-3 sm:-ml-4">
                  {featured.length === 0
                    ? Array.from({ length: 5 }, (_, index) => (
                        <CarouselItem
                          key={index}
                          className="basis-1/2 pl-3 sm:basis-1/3 sm:pl-4 lg:basis-1/4 xl:basis-1/5"
                        >
                          <div className="space-y-2.5">
                            <Skeleton className="aspect-square rounded-xl" />
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-5 w-1/2" />
                          </div>
                        </CarouselItem>
                      ))
                    : featured.map((product) => (
                        <CarouselItem
                          key={product.id}
                          className="basis-1/2 pl-3 sm:basis-1/3 sm:pl-4 lg:basis-1/4 xl:basis-1/5"
                        >
                          <ProductCard
                            product={product}
                            onOpen={openProduct}
                            onAdd={handleQuickAdd}
                            canAdd={features.cart}
                          />
                        </CarouselItem>
                      ))}
                </CarouselContent>
                <CarouselPrevious
                  aria-label="Предыдущие товары"
                  className="hidden shadow-md sm:flex sm:-left-6 lg:-left-8"
                />
                <CarouselNext
                  aria-label="Следующие товары"
                  className="hidden shadow-md sm:flex sm:-right-6 lg:-right-8"
                />
              </Carousel>
            </section>

            <section id="catalog" className="shop-container scroll-mt-32 pt-12" aria-label="Каталог товаров">
              <SectionHeader
                title="Каталог кукол"
                subtitle={
                  activeCategoryName
                    ? `Категория «${activeCategoryName}»`
                    : "Выберите категорию или воспользуйтесь поиском"
                }
              />

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
                  <button
                    type="button"
                    onClick={() => setCategory("all")}
                    className={chipClass(category === "all")}
                  >
                    Все товары
                    <span className={countClass(category === "all")}>{totalProducts}</span>
                  </button>
                  {categories.map((item) => (
                    <button
                      key={item.slug}
                      type="button"
                      onClick={() => setCategory(item.slug)}
                      className={chipClass(category === item.slug)}
                    >
                      {item.name}
                      <span className={countClass(category === item.slug)}>{item.count}</span>
                    </button>
                  ))}
                </div>

                <Select value={sort} onValueChange={setSort}>
                  <SelectTrigger aria-label="Сортировка" className="h-10 w-[190px] shrink-0 rounded-full bg-white text-sm">
                    <SelectValue placeholder="Сортировка" />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {search && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#FCE8E8] px-3 text-[13px] font-semibold text-[#CC0000] transition-colors hover:bg-[#FAD9D9]"
                  >
                    Поиск: «{search}»
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                )}
                <p className="text-sm text-gray-500" aria-live="polite">
                  {loading
                    ? "Загружаем каталог…"
                    : `${products.length} ${pluralize(products.length, "товар", "товара", "товаров")}`}
                </p>
              </div>

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
              ) : products.length === 0 ? (
                <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-300 py-16 text-center">
                  <SearchX className="size-12 text-gray-300" aria-hidden="true" />
                  <p className="text-base font-bold text-gray-900">Ничего не нашлось</p>
                  <p className="max-w-xs text-sm text-gray-500">
                    {search
                      ? `По запросу «${search}» товаров нет. Попробуйте изменить запрос или категорию.`
                      : "В этой категории пока пусто. Загляните в другие!"}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      clearSearch();
                      setCategory("all");
                    }}
                    className="mt-1 rounded-full bg-[#CC0000] px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#A80000]"
                  >
                    Сбросить фильтры
                  </button>
                </div>
              ) : (
                <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {products.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onOpen={openProduct}
                      onAdd={handleQuickAdd}
                      canAdd={features.cart}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <Footer categories={categories} onSelectCategory={handleSelectCategory} />

      <AddedToCartDrawer
        product={addedProduct}
        quantity={addedQuantity}
        cart={cart}
        open={addedOpen}
        onOpenChange={setAddedOpen}
        onViewCart={() => {
          setAddedOpen(false);
          setCartOpen(true);
        }}
      />
      <CartDrawer
        cart={cart}
        open={cartOpen}
        onOpenChange={setCartOpen}
        onCheckout={() => {
          setCartOpen(false);
          setCheckoutOpen(true);
        }}
      />
      <CheckoutDialog cart={cart} open={checkoutOpen} onOpenChange={setCheckoutOpen} />
    </div>
  );
}

function parseProductId(value: string | null): number | null {
  if (value == null || value === "" || !/^\d+$/.test(value)) return null;
  const id = Number(value);
  return id >= 1 ? id : null;
}

/** Слаг категории из ?category= (латиница/цифры/дефис) или null («all» тоже null) */
function parseCategorySlug(value: string | null): string | null {
  if (value == null || value === "" || value === "all") return null;
  return /^[a-z0-9][a-z0-9-]{0,59}$/.test(value) ? value : null;
}

/** Параметр edit админки: "new" — создание, число — id товара, иначе null (список) */
function parseAdminEdit(value: string | null): "new" | number | null {
  if (value == null) return null;
  if (value === "new") return "new";
  if (/^\d+$/.test(value)) {
    const id = Number(value);
    return id >= 1 ? id : null;
  }
  return null;
}

function chipClass(active: boolean) {
  return cn(
    "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors",
    active ? "bg-[#CC0000] text-white" : "bg-gray-100 text-gray-800 hover:bg-gray-200",
  );
}

function countClass(active: boolean) {
  return cn("text-xs tabular-nums", active ? "text-white/75" : "text-gray-400");
}
