"use client";

// Круглые плитки категорий с фотографиями (как у Target).
// Каждая плитка — переход на отдельную страницу категории /?category=<slug>
// в том же окне; cmd/ctrl/shift и средняя кнопка — привычное поведение
// ссылки (фоновая вкладка на реальную страницу категории).

import type { MouseEvent } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { categoryTileImage } from "./category-images";
import type { CategoryWithCount } from "./types";

interface CategoryTilesProps {
  categories: CategoryWithCount[];
  activeCategory: string;
  /** Переход на страницу категории (виртуальный роут /?category=<slug>) */
  onSelectCategory: (slug: string) => void;
}

export function CategoryTiles({ categories, activeCategory, onSelectCategory }: CategoryTilesProps) {
  const navigate = (event: MouseEvent<HTMLAnchorElement>, slug: string) => {
    // Модификаторы и средняя кнопка — пусть браузер откроет ссылку сам
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onSelectCategory(slug);
  };

  return (
    <section className="shop-container pt-10" aria-label="Категории товаров">
      <div className="flex items-center gap-3">
        <span className="block h-7 w-1.5 rounded-full bg-[#CC0000]" aria-hidden="true" />
        <h2 className="text-xl font-extrabold tracking-tight text-gray-900 sm:text-2xl">Выберите категорию</h2>
      </div>

      <div className="mt-5 flex snap-x gap-4 overflow-x-auto no-scrollbar pb-1 sm:gap-6">
        {categories.map((category) => {
          const active = activeCategory === category.slug;
          return (
            <a
              key={category.slug}
              href={`/?category=${category.slug}`}
              onClick={(event) => navigate(event, category.slug)}
              aria-label={`Перейти в категорию «${category.name}»`}
              title={`Категория «${category.name}»`}
              className="group flex w-[92px] shrink-0 snap-start flex-col items-center gap-2.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC0000]/40 sm:w-[112px]"
            >
              <span
                className={cn(
                  "block overflow-hidden rounded-full ring-2 transition-all",
                  active ? "ring-[#CC0000]" : "ring-gray-200 group-hover:ring-[#CC0000]/50",
                )}
              >
                <Image
                  src={categoryTileImage(category.slug)}
                  alt={category.name}
                  width={112}
                  height={112}
                  unoptimized
                  className="size-[92px] object-cover transition-transform duration-300 group-hover:scale-105 sm:size-[112px]"
                />
              </span>
              <span
                className={cn(
                  "text-center text-xs font-medium leading-tight sm:text-sm",
                  active ? "font-bold text-[#CC0000]" : "text-gray-700 group-hover:text-[#CC0000]",
                )}
              >
                {category.name}
              </span>
            </a>
          );
        })}
      </div>
    </section>
  );
}
