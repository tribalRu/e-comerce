"use client";

// Страница товара (виртуальная страница на роуте `/` с параметром ?product=<id>).
// Сверху — как на референсе Target PDP: хлебные крошки → слева галерея с видами и
// миниатюрами (развернуть / в список желаний) → справа ссылка на категорию,
// заголовок, рейтинг, бейджи, цена, степпер и кнопка «Добавить в корзину».
// Если у товара несколько фото из CMS (менеджер фотографий в админке) — галерея
// из реальных фотографий в заданном порядке, стартовый вид — главная.
//
// Ниже блока с ценой и добавлением в корзину — секция «Об этом товаре» по
// референсу: тонкая серая линия-разделитель → крупный центрированный заголовок
// на белом фоне → аккордеон «Детали» (открыт: слева «Особенности» — буллеты с
// кнопкой «Показать ещё», справа «Описание») тоже на белом → затем серая
// подложка #F7F7F7 с белой карточкой, внутри которой три свёрнутых раздела с
// шевронами: «Характеристики», «Доставка и возврат», «Вопросы и ответы».
// Внизу — карусель похожих товаров.
//
// При прокрутке, когда блок с ценой, количеством и кнопкой «Добавить в корзину»
// уходит вверх за шапку, под шапкой появляется липкая панель покупки
// (StickyBuyBar — как на референсе Target) и скрывается при возврате блока.

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Heart,
  MapPin,
  Maximize2,
  TriangleAlert,
  Truck,
  Undo2,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ProductCard } from "./product-card";
import { QuantityStepper } from "./quantity-stepper";
import { SectionHeader } from "./section-header";
import { Stars } from "./stars";
import { StickyBuyBar } from "./sticky-buy-bar";
import { BADGE_LABELS, clamp, formatPrice, pluralize } from "./utils";
import type { Product } from "./types";

const BADGE_STYLES: Record<string, string> = {
  hit: "bg-[#CC0000] text-white",
  new: "bg-emerald-600 text-white",
  sale: "bg-white text-[#CC0000] ring-1 ring-[#CC0000]",
  deal: "bg-gray-900 text-white",
};

// Виды товара: у каждого товара одно фото — делаем «крупные планы»
// масштабированием (как миниатюры-крупные планы на референсе)
const GALLERY_VIEWS = [
  { id: "full", label: "Фото целиком", imageClass: "scale-100" },
  { id: "top", label: "Крупный план", imageClass: "scale-[1.8] origin-top" },
  { id: "bottom", label: "Детали наряда", imageClass: "scale-[1.8] origin-bottom" },
] as const;

// «Особенности» для аккордеона «Детали» — как Highlights на референсе
const HIGHLIGHTS: Record<string, string[]> = {
  "fashion-victoria": [
    "Кукла Виктория с длинными волосами — их легко расчёсывать, укладывать и заплетать в новые причёски",
    "Мини-гардероб и 6 сменных нарядов: от вечернего платья до спортивного костюма",
    "Расчёска и аксессуары для волос уже в комплекте",
    "Идеальный подарок юной моднице и первое знакомство с миром стиля",
  ],
  "fashion-runway": [
    "Кукла в гламурном наряде — готова к первому выходу на подиум",
    "Три сменных образа для бесконечных экспериментов со стилем",
    "Зеркальная сцена-подиум превращает детскую в backstage настоящего показа",
    "Отличный повод устроить показ мод для всей семьи",
  ],
  "fashion-summer": [
    "Кукла в ярком сарафане — летнее настроение круглый год",
    "Чемоданчик для хранения и переноски всех аксессуаров",
    "Шляпа, солнечные очки и мини-аксессуары в комплекте",
    "Компактный набор — удобно брать в дорогу и в гости",
  ],
  "baby-mia": [
    "Нежный пупс с реалистичной мимикой",
    "В комплекте мягкая пелёнка, бутылочка и соска",
    "Тело куклы можно купать — игра станет ещё реалистичнее",
    "Учит заботе и бережному уходу — первый «малыш» для маленькой мамы",
  ],
  "baby-twins": [
    "Две куклы-младенца в одном наборе — двойные игры и двойная радость",
    "Тома и Тим в уютных комбинезонах с голубым и розовым узором",
    "Куклы такие разные, но по-настоящему неразлучные",
    "Замечательный подарок для игры вдвоём — с сестрой, братом или подругой",
  ],
  "baby-mila-stroller": [
    "Кукла Мила с удобной коляской — мини-прогулки каждый день",
    "Капюшон от солнца и корзинка для любимых игрушек",
    "Ремни безопасности надёжно держат куклу на «прогулке»",
    "Коляска складывается одним движением — легко хранить и перевозить",
  ],
  "collectible-anastasia": [
    "Фарфоровая кукла в бальном платье с кружевом",
    "Волосы уложены в высокую причёску — работа мастеров",
    "Подставка в комплекте — удобно выставить куклу на полке",
    "Роскошный подарок коллекционеру на праздник или юбилей",
  ],
  "collectible-vintage": [
    "Кукла в стиле 60-х: горошек, перчатки и ретро-причёска",
    "Винтажная классика для ценителей кукольного искусства",
    "Детали эпохи — от силуэта платья до макияжа",
    "Изюминка любой домашней коллекции и стильный подарок",
  ],
  "collectible-theatre": [
    "Бархатное бордовое платье с золотым веером и маской",
    "Торжественный образ для выставочной витрины",
    "Кукла «Театральный сезон» — жемчужина коллекции",
    "Подарок ценителям театра и красивых кукол",
  ],
  "interactive-sonya": [
    "Говорит 30 фраз, поёт песенки и рассказывает сказки",
    "Глаза открываются и закрываются — кукла кажется совсем живой",
    "Батарейки уже в комплекте — играйте сразу из коробки",
    "Развивает речь и память: ребёнок подражает и запоминает сюжеты",
  ],
  "interactive-vet": [
    "Кукла-ветеринар Вера «лечит» зверей — игра в настоящего доктора",
    "Белый халат и плюшевый щенок-пациент в комплекте",
    "Чемоданчик доктора со стетоскопом и игрушечным шприцем",
    "Знакомит с профессией и учит заботе о животных",
  ],
  "interactive-teacher": [
    "Учительница Ольга проводит первый урок — школа прямо дома",
    "В наборе школьная доска, крошечные тетради, указка и глобус",
    "Кукла с подвижными руками — удобно «писать» на доске",
    "Помогает подготовиться к школе в игровой форме",
  ],
  "playsets-dollhouse": [
    "Трёхэтажный домик со спальней, кухней, гостиной и балконом",
    "Мебель уже внутри — заселяйтесь и играйте сразу",
    "Сборка за 20 минут по понятной инструкции",
    "Высота 90 см — просторно для кукол любого роста",
  ],
  "playsets-furniture": [
    "14 предметов мебели для кукольного дома в едином стиле",
    "Кровать с балдахином, обеденный стол, стулья, диван и торшер",
    "Продуманные детали — от мягких подушек до мини-посуды",
    "Отличное пополнение для любого домика мечты",
  ],
  "playsets-clothes-set": [
    "10 нарядов на все случаи — от уютной пижамы до бального платья",
    "Вешалки и коробка для хранения в комплекте",
    "Одежду легко надевать — справится даже маленькая хозяйка",
    "Бесконечные сочетания и первые уроки порядка в гардеробе",
  ],
  "playsets-teaset": [
    "Фарфоровый сервиз на 4 персоны — 15 предметов",
    "Чайник, чашки, блюдца и сахарница с цветочным узором",
    "Настоящее «взрослое» чаепитие для кукол и гостей",
    "Игра учит манерам, гостеприимству и сервировке стола",
  ],
};

function getHighlights(product: Product): string[] {
  const preset = HIGHLIGHTS[product.slug];
  if (preset && preset.length > 0) return preset;
  // Запасной вариант: первые предложения описания товара
  return product.description
    .split(". ")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (part.endsWith(".") ? part : `${part}.`))
    .slice(0, 3);
}

// Заголовок аккордеона как на референсе: жирный текст слева, шеврон справа,
// без подчёркивания при наведении, крупная зона для пальца
const ACCORDION_TRIGGER_CLASS =
  "py-5 text-base font-bold text-gray-900 hover:no-underline sm:text-lg [&>svg]:size-5 [&>svg]:text-gray-700";

interface ProductPageProps {
  productId: number;
  /** false — корзина выключена в админке: скрываем степпер, кнопку и липкую панель */
  cartEnabled: boolean;
  onAdd: (product: Product, quantity: number) => void;
  onQuickAdd: (product: Product) => void;
  onOpenProduct: (product: Product) => void;
  onGoCategory: (slug: string) => void;
  onGoHome: () => void;
}

export function ProductPage({
  productId,
  cartEnabled,
  onAdd,
  onQuickAdd,
  onOpenProduct,
  onGoCategory,
  onGoHome,
}: ProductPageProps) {
  const [product, setProduct] = useState<Product | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "notfound">("loading");
  const [related, setRelated] = useState<Product[]>([]);

  // Количество — общее для блока покупки и липкой панели (синхронный степпер)
  const [quantity, setQuantity] = useState(1);
  // Блок «цена + количество + Добавить в корзину», за которым следит скролл
  const buyBoxRef = useRef<HTMLDivElement>(null);
  const [barVisible, setBarVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Компонент перемонтируется при смене товара (key={productId} в родителе),
    // поэтому исходное состояние уже «loading» — здесь только загрузка данных.

    fetch(`/api/products/${productId}`)
      .then((res) => (res.ok ? res.json() : res.status === 404 ? null : Promise.reject(new Error("bad response"))))
      .then((data: Product | null) => {
        if (cancelled) return;
        if (!data) {
          setStatus("notfound");
          return;
        }
        setProduct(data);
        setStatus("ready");
        window.scrollTo({ top: 0 });
        // Похожие: сначала своя категория; если меньше 8 — добираем популярными
        // из других категорий, чтобы карусель не выглядела полупустой
        fetch(`/api/products?category=${data.category.slug}&sort=popular`)
          .then((res) => (res.ok ? res.json() : Promise.reject(new Error("bad response"))))
          .then(async (list: Product[]) => {
            if (cancelled) return;
            const sameCategory = list.filter((item) => item.id !== data.id).slice(0, 8);
            setRelated(sameCategory);
            if (sameCategory.length < 8) {
              const res = await fetch("/api/products?sort=popular");
              if (!res.ok || cancelled) return;
              const popular = (await res.json()) as Product[];
              const used = new Set([data.id, ...sameCategory.map((item) => item.id)]);
              const extra = popular.filter((item) => !used.has(item.id)).slice(0, 8 - sameCategory.length);
              setRelated([...sameCategory, ...extra]);
            }
          })
          .catch(() => {});
      })
      .catch(() => {
        if (!cancelled) setStatus("notfound");
      });

    return () => {
      cancelled = true;
    };
  }, [productId]);

  // Заголовок вкладки — имя товара (восстанавливаем при уходе)
  useEffect(() => {
    if (!product) return;
    const previous = document.title;
    document.title = `${product.name} — КуклаМаркет`;
    return () => {
      document.title = previous;
    };
  }, [product]);

  // Липкая панель покупки: показываем, когда блок с ценой и количеством
  // полностью ушёл вверх за шапку (его низ выше низа шапки); скрываем,
  // когда блок снова появляется из-под шапки. Высоту шапки берём из DOM,
  // чтобы не зависеть от жёсткой константы.
  useEffect(() => {
    if (status !== "ready") return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = buyBoxRef.current;
      if (!el) return;
      const header = document.querySelector("header");
      const headerBottom = header ? header.getBoundingClientRect().bottom : 76;
      setBarVisible(el.getBoundingClientRect().bottom < headerBottom);
    };
    const onScrollOrResize = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [status]);

  if (status === "loading") {
    return (
      <div className="shop-container pb-6 pt-4 sm:pt-6" aria-busy="true" aria-label="Загружаем товар">
        <Skeleton className="h-4 w-64 max-w-full" />
        <div className="mt-6 grid items-start gap-8 lg:grid-cols-2 lg:gap-12">
          <div>
            <Skeleton className="aspect-square w-full rounded-xl" />
            <div className="mt-3 flex gap-2.5">
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="size-16 rounded-lg sm:size-20" />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-9 w-11/12" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-10 w-52" />
            <Skeleton className="h-12 w-full max-w-sm rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  if (status === "notfound" || !product) {
    return (
      <div className="shop-container flex flex-col items-center gap-3 pb-12 pt-20 text-center">
        <p className="text-2xl font-extrabold text-gray-900">Товар не найден</p>
        <p className="max-w-sm text-sm text-gray-500">
          Возможно, он уже распродан или ссылка устарела. Загляните в каталог — там много других кукол!
        </p>
        <button
          type="button"
          onClick={onGoHome}
          className="mt-2 rounded-full bg-[#CC0000] px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#A80000]"
        >
          Вернуться в каталог
        </button>
      </div>
    );
  }

  const stockMax = product ? Math.max(product.stock, 1) : 1;
  const changeQuantity = (value: number) => setQuantity(clamp(value, 1, stockMax));

  return (
    <>
      {/* Липкая панель покупки — появляется при прокрутке за блок с ценой.
          Скрывается целиком, когда корзина выключена в админ-панели. */}
      {cartEnabled && (
        <StickyBuyBar
          product={product}
          visible={barVisible}
          quantity={quantity}
          onQuantityChange={changeQuantity}
          onGoCategory={onGoCategory}
        />
      )}

      <div className="shop-container pt-4 sm:pt-6">
        <ProductBreadcrumbs product={product} onGoHome={onGoHome} onGoCategory={onGoCategory} />

        <div className="mt-4 grid items-start gap-8 sm:mt-6 lg:grid-cols-2 lg:gap-12">
          <ProductGallery product={product} />
          <ProductInfo
            product={product}
            cartEnabled={cartEnabled}
            quantity={quantity}
            onQuantityChange={changeQuantity}
            buyBoxRef={buyBoxRef}
            onAdd={onAdd}
            onGoCategory={onGoCategory}
          />
        </div>
      </div>

      <div className="pb-6">
        <AboutItemSection product={product} />

        {related.length > 0 && (
          <section className="shop-container mt-10 sm:mt-14" aria-label="Похожие товары">
            <SectionHeader
              title="Похожие товары"
              subtitle={`Из категории «${product.category.name}» и не только — что ещё смотрят покупатели`}
            />
            <Carousel opts={{ align: "start", slidesToScroll: 2 }} className="mt-5">
              <CarouselContent className="-ml-3 sm:-ml-4">
                {related.map((item) => (
                  <CarouselItem
                    key={item.id}
                    className="basis-1/2 pl-3 sm:basis-1/3 sm:pl-4 lg:basis-1/4 xl:basis-1/5"
                  >
                    <ProductCard
                      product={item}
                      onOpen={onOpenProduct}
                      onAdd={onQuickAdd}
                      canAdd={cartEnabled}
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
        )}
      </div>
    </>
  );
}

function ProductBreadcrumbs({
  product,
  onGoHome,
  onGoCategory,
}: {
  product: Product;
  onGoHome: () => void;
  onGoCategory: (slug: string) => void;
}) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <button type="button" onClick={onGoHome} className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC0000]/30">
              Главная
            </button>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <button
              type="button"
              onClick={() => onGoCategory(product.category.slug)}
              className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC0000]/30"
            >
              {product.category.name}
            </button>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage className="max-w-[50vw] truncate text-gray-900 sm:max-w-sm">{product.name}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function ProductGallery({ product }: { product: Product }) {
  const { toast } = useToast();
  const [zoomOpen, setZoomOpen] = useState(false);

  // Фотографии товара из CMS (менеджер фотографий в админке): когда у товара
  // несколько реальных фото — галерея из них в порядке сортировки (стартовый
  // вид — главная фотография, та же, что на карточке). Одно фото — прежние
  // «виды» (полное + два крупных плана трансформациями), как на референсе.
  const photos = product.images ?? [];
  const multi = photos.length > 1;
  const views = multi
    ? photos.map((photo, index) => ({
        id: photo.url,
        label: `Фото ${index + 1}`,
        src: photo.url,
        imageClass: "scale-100",
      }))
    : GALLERY_VIEWS.map((item) => ({ ...item, src: product.image }));

  // Стартовый вид — главная фотография товара
  const [view, setView] = useState(() => {
    if (!multi) return 0;
    const mainIndex = photos.findIndex((photo) => photo.isMain);
    return mainIndex >= 0 ? mainIndex : 0;
  });
  const current = views[view] ?? views[0];

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-xl bg-[#F7F7F7] ring-1 ring-gray-200/70">
        <Image
          src={current.src}
          alt={`${product.name} — ${current.label.toLowerCase()}`}
          fill
          sizes="(min-width: 1024px) 45vw, 92vw"
          unoptimized
          priority
          className={cn("object-cover transition-transform duration-300", current.imageClass)}
        />

        {/* Развернуть фото (как на референсе) */}
        <button
          type="button"
          onClick={() => setZoomOpen(true)}
          aria-label="Развернуть фото"
          className="absolute right-3 top-3 flex size-10 items-center justify-center rounded-full bg-white/95 text-gray-700 shadow-md transition-colors hover:bg-white hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC0000]/40"
        >
          <Maximize2 className="size-[18px]" aria-hidden="true" />
        </button>

        {/* В список желаний — заглушка «В разработке» */}
        <button
          type="button"
          onClick={() =>
            toast({
              title: "В разработке",
              description: "Список желаний появится совсем скоро — оставайтесь с нами!",
            })
          }
          aria-label="Добавить в список желаний"
          className="absolute bottom-3 right-3 flex size-10 items-center justify-center rounded-full bg-white/95 text-gray-700 shadow-md transition-colors hover:bg-white hover:text-[#CC0000] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC0000]/40"
        >
          <Heart className="size-[18px]" aria-hidden="true" />
        </button>
      </div>

      {/* Миниатюры: реальные фото товара или «крупные планы» одного фото */}
      <div className="mt-3 flex gap-2.5" role="group" aria-label="Виды товара">
        {views.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setView(index)}
            aria-label={item.label}
            aria-pressed={index === view}
            className={cn(
              "relative size-16 overflow-hidden rounded-lg bg-[#F7F7F7] transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC0000] sm:size-20",
              index === view ? "ring-2 ring-[#CC0000]" : "ring-1 ring-gray-200/70 hover:ring-gray-400",
            )}
          >
            <Image
              src={item.src}
              alt=""
              fill
              sizes="80px"
              unoptimized
              className={cn("object-cover", item.imageClass)}
            />
          </button>
        ))}
      </div>

      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="max-w-3xl sm:rounded-2xl">
          <DialogTitle className="sr-only">{product.name}</DialogTitle>
          <DialogDescription className="sr-only">Увеличенное фото товара</DialogDescription>
          <div className="relative aspect-square overflow-hidden rounded-xl bg-[#F7F7F7]">
            <Image
              src={current.src}
              alt={product.name}
              fill
              sizes="(min-width: 768px) 768px, 92vw"
              unoptimized
              className={cn("object-cover", current.imageClass)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProductInfo({
  product,
  cartEnabled,
  quantity,
  onQuantityChange,
  buyBoxRef,
  onAdd,
  onGoCategory,
}: {
  product: Product;
  cartEnabled: boolean;
  quantity: number;
  onQuantityChange: (value: number) => void;
  buyBoxRef: React.RefObject<HTMLDivElement | null>;
  onAdd: (product: Product, quantity: number) => void;
  onGoCategory: (slug: string) => void;
}) {
  const discount = product.oldPrice ? Math.round((1 - product.price / product.oldPrice) * 100) : 0;
  const badgeLabel = product.badge ? BADGE_LABELS[product.badge] : undefined;
  const lowStock = product.stock > 0 && product.stock <= 12;

  return (
    <div className="min-w-0">
      {/* Ссылка на категорию — как «Shop all …» на референсе */}
      <button
        type="button"
        onClick={() => onGoCategory(product.category.slug)}
        className="rounded-sm text-sm font-medium text-gray-500 underline decoration-gray-300 underline-offset-4 transition-colors hover:text-[#CC0000] hover:decoration-[#CC0000] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC0000]/30"
      >
        Все товары: {product.category.name}
      </button>

      <h1 className="mt-1.5 text-2xl font-extrabold leading-tight tracking-tight text-gray-900 sm:text-3xl">
        {product.name}
      </h1>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <Stars rating={product.rating} />
        <span className="text-sm font-semibold text-gray-800">{product.rating.toFixed(1)}</span>
        <span className="text-sm text-gray-400" aria-hidden="true">
          ·
        </span>
        <span className="text-sm text-gray-500">
          {product.reviewsCount} {pluralize(product.reviewsCount, "отзыв", "отзыва", "отзывов")}
        </span>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        {badgeLabel && (
          <span
            className={cn(
              "rounded-full px-3 py-1 text-xs font-bold leading-none shadow-sm",
              BADGE_STYLES[product.badge as string],
            )}
          >
            {badgeLabel}
          </span>
        )}
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold leading-none text-gray-700">
          Возраст {product.ageMin}+
        </span>
        {product.stock > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold leading-none text-emerald-700">
            <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            В наличии: {product.stock} шт.
          </span>
        ) : (
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold leading-none text-gray-500">
            Нет в наличии
          </span>
        )}
      </div>

      {/* Блок покупки: цена → «осталось мало» → степпер + кнопка.
          Контейнер с ref — «маяк» для липкой панели: когда он уходит за шапку,
          панель появляется, когда возвращается — исчезает. */}
      <div ref={buyBoxRef}>
        <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span
            className={cn(
              "text-4xl font-extrabold tracking-tight",
              product.oldPrice ? "text-[#CC0000]" : "text-gray-900",
            )}
          >
            {formatPrice(product.price)}
          </span>
          {product.oldPrice && (
            <>
              <span className="text-lg text-gray-400 line-through">{formatPrice(product.oldPrice)}</span>
              <span className="rounded-full bg-[#FCE8E8] px-2 py-0.5 text-xs font-bold text-[#CC0000]">−{discount}%</span>
            </>
          )}
        </div>
        {lowStock && (
          <p className="mt-2 text-sm font-semibold text-amber-600">
            Осталось всего {product.stock} {pluralize(product.stock, "штука", "штуки", "штук")} — успейте!
          </p>
        )}

        {cartEnabled ? (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <QuantityStepper
              value={quantity}
              onChange={onQuantityChange}
              max={Math.max(product.stock, 1)}
            />
            <button
              type="button"
              disabled={product.stock === 0}
              onClick={() => onAdd(product, quantity)}
              className="h-11 min-w-[220px] flex-1 rounded-full bg-gray-900 text-sm font-bold text-white transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC0000]/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:h-12"
            >
              Добавить в корзину · {formatPrice(product.price * quantity)}
            </button>
          </div>
        ) : (
          <p className="mt-6 inline-flex rounded-full bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-500">
            Покупки временно приостановлены
          </p>
        )}
      </div>
    </div>
  );
}

// Секция «Об этом товаре» — по референсу: на белом фоне тонкая линия-разделитель,
// крупный центрированный заголовок и аккордеон «Детали» (Особенности + Описание),
// ниже — серая подложка #F7F7F7 с белой карточкой свёрнутых разделов
function AboutItemSection({ product }: { product: Product }) {
  return (
    <section aria-label="Об этом товаре" className="mt-10 sm:mt-14">
      {/* Заголовок и «Детали» — на белом фоне страницы (как на референсе) */}
      <div className="shop-container border-t border-gray-200 pt-8 sm:pt-10">
        <h2 className="text-center text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">
          Об этом товаре
        </h2>

        <Accordion type="single" collapsible defaultValue="details" className="mt-2 sm:mt-4">
          <AccordionItem value="details" className="border-gray-200 border-b-0">
            <AccordionTrigger className={ACCORDION_TRIGGER_CLASS}>Детали</AccordionTrigger>
            <AccordionContent className="pb-6 sm:pb-8">
              <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
                <HighlightsBlock product={product} />
                <div>
                  <h3 className="text-[15px] font-bold text-gray-900">Описание</h3>
                  <p className="mt-3.5 text-sm leading-relaxed text-gray-700">{product.description}</p>
                  <p className="mt-4 text-xs leading-relaxed text-gray-400">
                    Производитель: {product.brand}. Комплектация уточнена в разделе «Особенности».
                  </p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Серая подложка с белой карточкой свёрнутых разделов (как на референсе) */}
      <div className="shop-container mt-6 sm:mt-8">
        <div className="rounded-lg bg-[#F7F7F7] p-3 sm:p-4">
          <div className="rounded-xl bg-white px-4 py-2 sm:px-8 sm:py-3 lg:px-10">
            <Accordion type="single" collapsible>
              <AccordionItem value="specs">
                <AccordionTrigger className={ACCORDION_TRIGGER_CLASS}>Характеристики</AccordionTrigger>
                <AccordionContent className="pb-6 sm:pb-8">
                  <SpecsBlock product={product} />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="shipping">
                <AccordionTrigger className={ACCORDION_TRIGGER_CLASS}>Доставка и возврат</AccordionTrigger>
                <AccordionContent className="pb-6 sm:pb-8">
                  <ShippingBlock product={product} />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="qa">
                <AccordionTrigger className={ACCORDION_TRIGGER_CLASS}>Вопросы и ответы</AccordionTrigger>
                <AccordionContent className="pb-6 sm:pb-8">
                  <QaBlock product={product} />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </div>
    </section>
  );
}

// «Особенности» — буллеты с кнопкой «Показать ещё» (как Highlights на референсе):
// свёрнуто — первые 3 пункта с ограничением в 2 строки, развёрнуто — всё целиком
function HighlightsBlock({ product }: { product: Product }) {
  const highlights = getHighlights(product);
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? highlights : highlights.slice(0, 3);
  const canExpand = highlights.length > 3;

  return (
    <div>
      <h3 className="text-[15px] font-bold text-gray-900">Особенности</h3>
      <ul className="mt-3.5 space-y-3">
        {visible.map((text, index) => (
          <li key={index} className="flex gap-3">
            <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-gray-700" aria-hidden="true" />
            <span className={cn("text-sm leading-relaxed text-gray-700", !expanded && "line-clamp-2")}>{text}</span>
          </li>
        ))}
      </ul>
      {canExpand && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="mt-4 inline-flex h-9 items-center rounded-full border border-gray-300 bg-white px-5 text-[13px] font-semibold text-gray-800 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC0000]/40"
        >
          {expanded ? "Свернуть" : "Показать ещё"}
        </button>
      )}
    </div>
  );
}

function SpecsBlock({ product }: { product: Product }) {
  const pairs: Array<[string, string]> = [
    ["Бренд", product.brand],
    ["Категория", product.category.name],
    ["Рекомендуемый возраст", `от ${product.ageMin} ${pluralize(product.ageMin, "года", "лет", "лет")}`],
    [
      "Наличие на складе",
      `${product.stock} ${pluralize(product.stock, "штука", "штуки", "штук")}`,
    ],
    ["Артикул", product.slug],
  ];

  return (
    <dl className="grid gap-x-12 sm:grid-cols-2">
      {pairs.map(([term, value]) => (
        <div key={term} className="flex gap-6 border-b border-gray-100 py-3">
          <dt className="w-40 shrink-0 text-gray-500">{term}</dt>
          <dd className="min-w-0 font-semibold text-gray-900">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ShippingBlock({ product }: { product: Product }) {
  const { toast } = useToast();

  return (
    <div>
      <ul className="space-y-5">
        <li className="flex gap-3.5">
          <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-[#FDF4F4] text-[#CC0000]">
            <Truck className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900">Доставка курьером</p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-gray-600">
              Бесплатно при заказе от 3 000 ₽ · 1–2 рабочих дня
            </p>
          </div>
        </li>
        <li>
          <button
            type="button"
            onClick={() =>
              toast({
                title: "В разработке",
                description: "Проверка самовывоза по вашему адресу появится совсем скоро — оставайтесь с нами!",
              })
            }
            className="flex w-full gap-3.5 rounded-lg p-1 text-left transition-colors hover:bg-[#FAFAFA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC0000]/30"
            aria-label="Проверить самовывоз"
          >
            <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-[#FDF4F4] text-[#CC0000]">
              <MapPin className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-gray-900">Самовывоз из магазина</span>
              <span className="mt-0.5 block text-[13px] leading-relaxed text-gray-600">
                Бесплатно, готовность — от 2 часов. Проверить магазины поблизости
              </span>
            </span>
          </button>
        </li>
        <li className="flex gap-3.5">
          <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-[#FDF4F4] text-[#CC0000]">
            <Undo2 className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900">Лёгкий возврат</p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-gray-600">
              30 дней на возврат — в магазине или почтой, с полным возмещением
            </p>
          </div>
        </li>
      </ul>

      {/* Предупреждение (как WARNING на референсе) */}
      <p className="mt-6 flex items-start gap-2.5 text-[13px] leading-relaxed text-gray-700">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden="true" />
        <span>
          <strong className="font-bold">ВНИМАНИЕ:</strong> содержит мелкие детали. Не подходит для детей младше{" "}
          {product.ageMin} {pluralize(product.ageMin, "года", "лет", "лет")}.
        </span>
      </p>
    </div>
  );
}

function QaBlock({ product }: { product: Product }) {
  const { toast } = useToast();

  const entries = [
    {
      question: "На какой возраст рассчитан этот товар?",
      answer: `Производитель рекомендует возраст от ${product.ageMin} ${pluralize(product.ageMin, "года", "лет", "лет")}. В наборе есть мелкие детали — для малышей игра проходит вместе со взрослыми.`,
    },
    {
      question: "Товар точно есть в наличии?",
      answer:
        product.stock > 0
          ? `Да, сейчас на складе ${product.stock} ${pluralize(product.stock, "штука", "штуки", "штук")}. Доставим курьером за 1–2 рабочих дня или подготовим к самовывозу уже через 2 часа.`
          : "Сейчас товар распродан. Загляните в похожие товары ниже — возможно, там есть похожая модель.",
    },
    {
      question: "Что делать, если кукла не понравится?",
      answer:
        "У вас есть 30 дней на лёгкий возврат: в магазине или почтой, с полным возмещением. Достаточно сохранить упаковку и чек.",
    },
  ];

  return (
    <div>
      <ul className="divide-y divide-gray-100">
        {entries.map((entry) => (
          <li key={entry.question} className="py-4 first:pt-0 last:pb-0">
            <h4 className="text-sm font-bold text-gray-900">{entry.question}</h4>
            <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{entry.answer}</p>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() =>
          toast({
            title: "В разработке",
            description: "Возможность задать свой вопрос о товаре появится совсем скоро — оставайтесь с нами!",
          })
        }
        className="mt-5 inline-flex h-9 items-center rounded-full border border-gray-300 bg-white px-5 text-[13px] font-semibold text-gray-800 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC0000]/40"
      >
        Задать вопрос о товаре
      </button>
    </div>
  );
}
