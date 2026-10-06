"use client";

// Шапка в стиле Target (референс — скриншот 2025-редизайна):
// тонкая красная полоса сверху → белый бар: лого-яблочко, ссылки
// «Категории ▾ / Акции / Доставка», серая пилюля поиска с
// микрофоном и лупой, кнопка ИИ «Спроси КуклаМаркет», аккаунт, корзина.
// ИИ-функции, голосовой поиск, самовывоз и аккаунт — заглушки «В разработке».

import {
  Check,
  ChevronDown,
  CircleUserRound,
  Mic,
  Search,
  ShoppingCart,
  Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { BullseyeLogo } from "./logo";
import type { CategoryWithCount, SiteFeatures } from "./types";

interface HeaderProps {
  /** Переключатели функционала из /api/settings (админ-панель) */
  features: SiteFeatures;
  categories: CategoryWithCount[];
  activeCategory: string;
  onSelectCategory: (slug: string) => void;
  cartCount: number;
  onOpenCart: () => void;
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onSubmitSearch: (query: string) => void;
  onGoDeals: () => void;
  onGoHome: () => void;
}

export function Header({
  features,
  categories,
  activeCategory,
  onSelectCategory,
  cartCount,
  onOpenCart,
  searchInput,
  onSearchInputChange,
  onSubmitSearch,
  onGoDeals,
  onGoHome,
}: HeaderProps) {
  const { toast } = useToast();
  const totalProducts = categories.reduce((sum, item) => sum + item.count, 0);

  // Заглушка для функций в разработке (ИИ, голосовой поиск, самовывоз, аккаунт)
  const comingSoon = (feature: string) => {
    toast({
      title: "В разработке",
      description: `${feature} появится совсем скоро — оставайтесь с нами!`,
    });
  };

  const navLinkClass =
    "whitespace-nowrap text-[15px] font-semibold text-[#333] transition-colors hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC0000]/30 focus-visible:ring-offset-2 rounded-sm";

  return (
    <header className="sticky top-0 z-50 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.08)]">
      {/* Тонкая красная полоса, как на референсе */}
      <div className="h-3 bg-[#CC0000]" aria-hidden="true" />

      {/* Основной белый бар */}
      <div className="shop-container flex h-16 items-center gap-3 sm:gap-5">
        {/* Логотип-яблочко (только знак, как у Target): со страницы товара — на витрину */}
        <button
          type="button"
          onClick={onGoHome}
          className="flex shrink-0 items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC0000]/30"
          aria-label="КуклаМаркет — на главную"
        >
          <BullseyeLogo className="size-9 sm:size-10" />
        </button>

        {/* Навигация: Категории (дропдаун) · Акции · Доставка (заглушка) */}
        <nav aria-label="Основная навигация" className="hidden items-center gap-5 md:flex">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className={cn(navLinkClass, "flex items-center gap-1")}>
                Категории
                <ChevronDown className="size-4" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 rounded-xl p-1.5">
              <DropdownMenuItem
                onSelect={() => onSelectCategory("all")}
                className="gap-2 rounded-lg py-2.5 text-[15px] font-medium text-[#333]"
              >
                <span className="flex-1">Все товары</span>
                {activeCategory === "all" ? (
                  <Check className="size-4 text-[#CC0000]" aria-hidden="true" />
                ) : (
                  <span className="text-xs tabular-nums text-gray-400">{totalProducts}</span>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1" />
              {categories.map((category) => (
                <DropdownMenuItem
                  key={category.slug}
                  onSelect={() => onSelectCategory(category.slug)}
                  className="gap-2 rounded-lg py-2.5 text-[15px] font-medium text-[#333]"
                >
                  <span className="flex-1">{category.name}</span>
                  {activeCategory === category.slug ? (
                    <Check className="size-4 text-[#CC0000]" aria-hidden="true" />
                  ) : (
                    <span className="text-xs tabular-nums text-gray-400">{category.count}</span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <button type="button" onClick={onGoDeals} className={navLinkClass}>
            Акции
          </button>

          <button
            type="button"
            onClick={() => comingSoon("Самовывоз и доставка")}
            className={cn(navLinkClass, "hidden xl:block")}
          >
            Доставка
          </button>
        </nav>

        {/* Пилюля поиска + кнопка ИИ */}
        <form
          role="search"
          className="flex min-w-0 flex-1 items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmitSearch(searchInput);
          }}
        >
          <div className="relative min-w-0 flex-1">
            <label htmlFor="shop-search" className="sr-only">
              Поиск по каталогу
            </label>
            <Input
              id="shop-search"
              type="search"
              value={searchInput}
              onChange={(e) => onSearchInputChange(e.target.value)}
              placeholder="Что найти для вашей куклы?"
              className="h-10 rounded-full border-transparent bg-[#F7F7F7] pl-5 pr-[76px] text-[15px] placeholder:text-gray-500 focus-visible:border-[#CC0000] focus-visible:ring-[#CC0000]/25 sm:h-11"
            />
            <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center">
              {features.voiceSearch && (
                <button
                  type="button"
                  onClick={() => comingSoon("Голосовой поиск")}
                  aria-label="Голосовой поиск"
                  className="flex size-8 items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-[#EBEBEB] hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC0000]/30"
                >
                  <Mic className="size-[18px]" aria-hidden="true" />
                </button>
              )}
              <button
                type="submit"
                aria-label="Искать"
                className="flex size-8 items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-[#EBEBEB] hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC0000]/30"
              >
                <Search className="size-[18px]" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* ИИ-кнопка «Спроси КуклаМаркет» (заглушка «В разработке»);
              скрывается, когда ИИ-помощник выключен в админ-панели */}
          {features.aiAssistant && (
            <button
              type="button"
              onClick={() => comingSoon("ИИ-помощник КуклаМаркет")}
              className="hidden h-10 shrink-0 items-center gap-2 rounded-full border border-[#CC0000] bg-white px-3 text-[13px] font-bold transition-colors hover:bg-[#FDF4F4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC0000]/30 focus-visible:ring-offset-2 sm:flex sm:h-11 sm:px-3.5"
              aria-label="Спроси КуклаМаркет — ИИ-помощник"
            >
              <Sparkles className="size-4 shrink-0 text-[#CC0000]" aria-hidden="true" />
              <span className="hidden text-gray-900 sm:inline">Спроси&nbsp;</span>
              <span className="hidden text-[#CC0000] sm:inline">КуклаМаркет</span>
              <span className="sr-only">— ИИ-помощник</span>
            </button>
          )}
        </form>

        {/* Аккаунт — скрывается, когда личный кабинет выключен в админ-панели */}
        {features.account && (
          <button
            type="button"
            onClick={() => comingSoon("Личный кабинет")}
            className="hidden items-center gap-1.5 rounded-full px-1.5 py-1.5 text-[13px] font-semibold text-[#333] transition-colors hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC0000]/30 lg:flex"
            aria-label="Аккаунт — вход в личный кабинет"
          >
            <CircleUserRound className="size-6" aria-hidden="true" />
            <span className="hidden xl:inline">Привет, гость</span>
          </button>
        )}

        {/* Корзина — скрывается, когда корзина выключена в админ-панели */}
        {features.cart && (
          <button
            type="button"
            onClick={onOpenCart}
            className="relative flex size-10 shrink-0 items-center justify-center rounded-full text-[#333] transition-colors hover:bg-[#F7F7F7] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC0000]/30"
            aria-label={`Корзина, товаров: ${cartCount}`}
          >
            <ShoppingCart className="size-6" aria-hidden="true" />
            {cartCount > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#CC0000] px-1 text-[10px] font-bold tabular-nums text-white ring-2 ring-white">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </button>
        )}
      </div>
    </header>
  );
}
