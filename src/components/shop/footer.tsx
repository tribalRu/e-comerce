"use client";

// Футер: красная линия сверху, колонки ссылок, контакты (прижат к низу через mt-auto).
// Ссылки каталога ведут на отдельные страницы категорий /?category=<slug>.

import { Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import type { MouseEvent } from "react";
import { BullseyeLogo } from "./logo";
import type { CategoryWithCount } from "./types";

const BUYER_INFO = [
  { title: "Доставка", text: "Курьером по России 2–4 дня, бесплатно от 3 000 ₽" },
  { title: "Оплата", text: "Картой онлайн или при получении" },
  { title: "Возврат", text: "90 дней на возврат без лишних вопросов" },
  { title: "Гарантия", text: "Все куклы сертифицированы" },
];

interface FooterProps {
  categories: CategoryWithCount[];
  onSelectCategory: (slug: string) => void;
}

export function Footer({ categories, onSelectCategory }: FooterProps) {
  // SPA-переход на страницу категории; модификаторы и средняя кнопка —
  // нативное поведение ссылки (новая вкладка на реальную страницу)
  const navigate = (event: MouseEvent<HTMLAnchorElement>, slug: string) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onSelectCategory(slug);
  };

  return (
    <footer className="mt-auto border-t-2 border-[#CC0000] bg-[#F7F7F7]">
      <div className="shop-container grid gap-10 py-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
        <div>
          <div className="flex items-center gap-2.5">
            <BullseyeLogo className="size-9" />
            <span className="text-lg font-extrabold tracking-tight text-[#CC0000]">КуклаМаркет</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-gray-500">
            Всё для кукол и их маленьких хозяек: от первых пупсов до коллекционного фарфора.
          </p>
        </div>

        <nav aria-label="Покупателям">
          <h3 className="text-sm font-bold uppercase tracking-wide text-gray-900">Покупателям</h3>
          <ul className="mt-3 space-y-3">
            {BUYER_INFO.map((item) => (
              <li key={item.title}>
                <p className="text-sm font-semibold text-gray-700">{item.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{item.text}</p>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Каталог">
          <h3 className="text-sm font-bold uppercase tracking-wide text-gray-900">Каталог</h3>
          <ul className="mt-3 space-y-2">
            <li>
              <a
                href="/"
                onClick={(event) => navigate(event, "all")}
                className="rounded-sm text-sm text-gray-600 transition-colors hover:text-[#CC0000] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC0000]/30"
              >
                Все товары
              </a>
            </li>
            {categories.map((category) => (
              <li key={category.slug}>
                <a
                  href={`/?category=${category.slug}`}
                  onClick={(event) => navigate(event, category.slug)}
                  className="rounded-sm text-sm text-gray-600 transition-colors hover:text-[#CC0000] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC0000]/30"
                >
                  {category.name}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-gray-900">Контакты</h3>
          <ul className="mt-3 space-y-3 text-sm text-gray-600">
            <li className="flex items-center gap-2">
              <Phone className="size-4 shrink-0 text-[#CC0000]" aria-hidden="true" />
              +7 (495) 000-00-00
            </li>
            <li className="flex items-center gap-2">
              <Mail className="size-4 shrink-0 text-[#CC0000]" aria-hidden="true" />
              hello@kuklamarket.ru
            </li>
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-[#CC0000]" aria-hidden="true" />
              Москва, ул. Кукольная, 7
            </li>
          </ul>
          <p className="mt-4 text-xs text-gray-400">Ежедневно с 9:00 до 21:00</p>
        </div>
      </div>

      <div className="border-t border-gray-200">
        <div className="shop-container flex flex-col items-center justify-between gap-2 py-4 text-xs text-gray-500 sm:flex-row">
          <p>© {new Date().getFullYear()} КуклаМаркет. Все права защищены.</p>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <p>Цены на сайте не являются публичной офертой</p>
            {/* Вход в админ-панель (виртуальный роут /?admin=1) */}
            <Link
              href="/?admin=1"
              className="rounded-sm font-semibold text-gray-400 transition-colors hover:text-[#CC0000] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC0000]/30"
            >
              Управление магазином
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
