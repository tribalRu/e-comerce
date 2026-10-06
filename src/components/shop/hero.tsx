"use client";

// Hero-баннер «Неделя кукол» + полоса преимуществ.
// Постер и тексты баннера (надзаголовок/заголовок/подпись/кнопка) редактируются в
// админ-панели (/?admin=1 → «Функционал и баннер») и приходят через content;
// пустые надзаголовок/подпись просто скрываются.

import Image from "next/image";
import { RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { FadeIn } from "./fade-in";
import { DEFAULT_HERO_CONTENT } from "./types";
import type { HeroContent } from "./types";

const USP = [
  { icon: Truck, title: "Быстрая доставка", text: "Бесплатно при заказе от 3 000 ₽" },
  { icon: RotateCcw, title: "Лёгкий возврат", text: "90 дней на раздумья" },
  { icon: ShieldCheck, title: "Гарантия качества", text: "Сертифицированные куклы" },
];

export function Hero({ onShopNow, content }: { onShopNow: () => void; content?: HeroContent }) {
  const poster = content?.image?.trim() || DEFAULT_HERO_CONTENT.image;
  const kicker = content?.kicker ?? DEFAULT_HERO_CONTENT.kicker;
  const title = content?.title ?? DEFAULT_HERO_CONTENT.title;
  const subtitle = content?.subtitle ?? DEFAULT_HERO_CONTENT.subtitle;
  const ctaText = content?.ctaText ?? DEFAULT_HERO_CONTENT.ctaText;

  return (
    <section className="shop-container pt-4 sm:pt-6" aria-label="Главный баннер">
      <FadeIn>
        <div className="relative isolate overflow-hidden rounded-xl bg-gray-100 sm:rounded-2xl">
          <Image
            key={poster}
            src={poster}
            alt={`Промо-баннер: ${title}`}
            width={1440}
            height={720}
            priority
            unoptimized
            className="h-[300px] w-full object-cover sm:h-[400px] lg:h-[460px]"
          />
          <div
            className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent"
            aria-hidden="true"
          />
          <div className="absolute inset-0 flex flex-col justify-center p-6 sm:p-12">
            {kicker && (
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/90">{kicker}</p>
            )}
            <h1 className="mt-3 max-w-xl text-3xl font-extrabold leading-tight text-white sm:text-4xl lg:text-5xl">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-3 max-w-md text-sm text-white/90 sm:text-base">{subtitle}</p>
            )}
            <button
              type="button"
              onClick={onShopNow}
              className="mt-6 w-fit rounded-full bg-[#CC0000] px-8 py-3 text-sm font-bold text-white shadow-lg transition-colors hover:bg-[#A80000] sm:text-base"
            >
              {ctaText}
            </button>
          </div>
        </div>
      </FadeIn>

      <div className="mt-4 grid gap-3 sm:grid-cols-3 sm:gap-4">
        {USP.map((usp, index) => (
          <FadeIn key={usp.title} delay={0.08 * (index + 1)}>
            <div className="flex items-center gap-3.5 rounded-xl border border-gray-200 bg-white p-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#FCE8E8] text-[#CC0000]">
                <usp.icon className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900">{usp.title}</p>
                <p className="mt-0.5 truncate text-xs text-gray-500 sm:text-[13px]">{usp.text}</p>
              </div>
            </div>
          </FadeIn>
        ))}
      </div>
    </section>
  );
}
