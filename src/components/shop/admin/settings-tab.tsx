"use client";

// Раздел «Функционал и баннер» админ-панели:
// 1) Переключатели функционала витрины — PUT /api/settings { features: { … } },
//    применяются мгновенно: на витрине скрываются кнопка корзины и «Добавить в
//    корзину», ИИ-помощник, голосовой поиск, личный кабинет.
// 2) Главный баннер: постер (загрузка с компьютера кнопкой и перетаскиванием,
//    библиотека постеров, возврат стандартного) и тексты (надзаголовок,
//    заголовок, подпись, кнопка). Живое превью показывает баннер как на витрине.
//    Сохранение — одна кнопка: PUT /api/settings { hero: { image, …texts } }.

import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ImagePlus,
  Loader2,
  Megaphone,
  RotateCcw,
  Save,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { DEFAULT_HERO_CONTENT, DEFAULT_HERO_IMAGE } from "../types";
import type { HeroContent, SiteFeatures, SiteSettings } from "../types";

const FEATURE_ROWS: { key: keyof SiteFeatures; title: string; desc: string }[] = [
  {
    key: "cart",
    title: "Корзина и оформление заказов",
    desc: "Кнопка корзины в шапке, «В корзину» в каталоге и «Добавить в корзину» на странице товара",
  },
  {
    key: "aiAssistant",
    title: "ИИ-помощник «Спроси КуклаМаркет»",
    desc: "Кнопка в шапке рядом со строкой поиска",
  },
  {
    key: "voiceSearch",
    title: "Голосовой поиск",
    desc: "Иконка микрофона в строке поиска",
  },
  {
    key: "account",
    title: "Личный кабинет",
    desc: "Кнопка аккаунта «Привет, гость» в шапке",
  },
];

/** Максимальный размер постера (валидация сервера — 8 МБ) */
const MAX_FILE_SIZE = 8 * 1024 * 1024;

/** Допустимые MIME-типы загрузки (контракт POST /api/upload/hero) */
const ACCEPTED_MIME = ["image/png", "image/jpeg", "image/webp", "image/avif", "image/gif"];

interface StoreSettingsTabProps {
  settings: SiteSettings | null;
  /** перечитать настройки после успешного сохранения */
  onSaved: () => void;
}

export function StoreSettingsTab({ settings, onSaved }: StoreSettingsTabProps) {
  const { toast } = useToast();
  const [features, setFeatures] = useState<SiteFeatures | null>(null);
  const [hero, setHero] = useState<HeroContent>(DEFAULT_HERO_CONTENT);
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [savingHero, setSavingHero] = useState(false);

  // Постер: загрузка с компьютера (blob-превью на время запроса)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [posterUploading, setPosterUploading] = useState(false);
  const [posterPreview, setPosterPreview] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const dragDepth = useRef(0);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [posters, setPosters] = useState<string[]>([]);

  // Локальное зеркало настроек. Пока идёт запрос переключателя — не трогаем
  // (там оптимистичное состояние); иначе синхронизируемся с сервером: так
  // быстрые последовательные переключения сходятся к истине из GET /api/settings.
  // Hero-форма заполняется один раз, чтобы не сбрасывать правки при перечитывании.
  useEffect(() => {
    if (!settings || pendingKey) return;
    setFeatures(settings.features);
    if (!heroLoaded) {
      setHero(settings.hero);
      setHeroLoaded(true);
    }
  }, [settings, heroLoaded, pendingKey]);

  // Библиотека постеров (загруженные ранее + стандартный)
  useEffect(() => {
    fetch("/api/images?dir=hero")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data: string[]) => setPosters(data))
      .catch(() => {});
  }, []);

  const toggleFeature = async (key: keyof SiteFeatures, value: boolean, title: string) => {
    if (!features) return;
    const previous = features;
    setFeatures({ ...features, [key]: value });
    setPendingKey(key);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ features: { [key]: value } }),
      });
      if (!res.ok) throw new Error("bad response");
      // Ответ сервера — истина: синхронизируем все флага разом (при быстрых
      // последовательных переключениях замыкание может быть устаревшим)
      const data = (await res.json()) as SiteSettings;
      setFeatures(data.features);
      toast({
        title: value ? "Функция включена" : "Функция выключена",
        description: `${title} — уже ${value ? "видна" : "скрыта"} на витрине`,
      });
      onSaved();
    } catch {
      setFeatures(previous);
      toast({ title: "Не получилось", description: "Попробуйте ещё раз", variant: "destructive" });
    } finally {
      setPendingKey(null);
    }
  };

  // ---------- Загрузка постера с компьютера ----------

  const uploadPoster = (file: File) => {
    if (posterUploading) return;
    if (!ACCEPTED_MIME.includes(file.type)) {
      toast({
        title: "Файл не подойдёт",
        description: "Поддерживаются PNG, JPEG, WebP, AVIF и GIF",
      });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "Файл больше 8 МБ",
        description: "Уменьшите размер постера перед загрузкой",
      });
      return;
    }

    // Оптимистичное превью на время загрузки
    const blobUrl = URL.createObjectURL(file);
    setPosterPreview(blobUrl);
    setPosterUploading(true);

    const body = new FormData();
    body.append("file", file);
    fetch("/api/upload/hero", { method: "POST", body })
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
        if (!res.ok || !data?.url) {
          throw new Error(data?.error ?? "Сервер недоступен");
        }
        return data.url;
      })
      .then((url) => {
        setHero((prev) => ({ ...prev, image: url }));
        setPosters((prev) => (prev.includes(url) ? prev : [url, ...prev]));
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
      })
      .catch((error: unknown) => {
        const reason = error instanceof Error ? error.message : "Попробуйте ещё раз";
        toast({
          title: "Постер не загрузился",
          description: `${file.name || "Файл"} — ${reason}`,
          variant: "destructive",
        });
        URL.revokeObjectURL(blobUrl);
      })
      .finally(() => {
        setPosterPreview(null);
        setPosterUploading(false);
      });
  };

  const openFileDialog = () => fileInputRef.current?.click();

  const posterDropHandlers = {
    onDragEnter: (event: React.DragEvent) => {
      if (!event.dataTransfer?.types?.includes("Files")) return;
      event.preventDefault();
      dragDepth.current += 1;
      setDragActive(true);
    },
    onDragOver: (event: React.DragEvent) => {
      if (!event.dataTransfer?.types?.includes("Files")) return;
      event.preventDefault();
    },
    onDragLeave: () => {
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragActive(false);
    },
    onDrop: (event: React.DragEvent) => {
      const file = event.dataTransfer?.files?.[0];
      if (!file) return;
      event.preventDefault();
      dragDepth.current = 0;
      setDragActive(false);
      uploadPoster(file);
    },
  };

  const isDefaultPoster = hero.image === DEFAULT_HERO_IMAGE;
  const previewSrc = posterPreview ?? hero.image;

  const saveHero = async () => {
    if (!hero.title.trim()) {
      toast({ title: "Нужен заголовок", description: "Заголовок баннера не может быть пустым" });
      return;
    }
    if (posterUploading) {
      toast({ title: "Дождитесь загрузки постера" });
      return;
    }
    setSavingHero(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hero: {
            image: hero.image.trim() || DEFAULT_HERO_IMAGE,
            kicker: hero.kicker.trim(),
            title: hero.title.trim(),
            subtitle: hero.subtitle.trim(),
            ctaText: hero.ctaText.trim() || DEFAULT_HERO_CONTENT.ctaText,
          },
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "");
      }
      toast({ title: "Баннер обновлён", description: "Постер и тексты уже на главной странице" });
      onSaved();
    } catch (error) {
      toast({
        title: "Не удалось сохранить баннер",
        description:
          error instanceof Error && error.message ? error.message : "Попробуйте ещё раз",
        variant: "destructive",
      });
    } finally {
      setSavingHero(false);
    }
  };

  if (!settings || !features) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid items-start gap-5 lg:grid-cols-2">
      {/* Функционал витрины */}
      <section
        aria-label="Функционал витрины"
        className="rounded-xl border border-gray-200 bg-white p-5"
      >
        <h2 className="text-base font-extrabold text-gray-900">Функционал витрины</h2>
        <p className="mt-1 text-xs text-gray-500">
          Выключенные функции сразу исчезают с главной страницы и страницы товара
        </p>
        <ul className="mt-4 divide-y divide-gray-100">
          {FEATURE_ROWS.map((row) => (
            <li key={row.key} className="flex items-center justify-between gap-4 py-3.5">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">{row.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{row.desc}</p>
              </div>
              <Switch
                checked={features[row.key]}
                disabled={pendingKey === row.key}
                onCheckedChange={(value) => void toggleFeature(row.key, value, row.title)}
                aria-label={row.title}
              />
            </li>
          ))}
        </ul>
        {!features.cart && (
          <p
            className="mt-3 rounded-lg bg-[#FCE8E8] px-3.5 py-2.5 text-xs font-semibold text-[#CC0000]"
            role="status"
          >
            Корзина выключена: покупатели пока не могут добавлять товары и оформлять заказы
          </p>
        )}
      </section>

      {/* Главный баннер: постер + тексты */}
      <section
        aria-label="Главный баннер"
        className="rounded-xl border border-gray-200 bg-white p-5"
      >
        <div className="flex items-center gap-2">
          <Megaphone className="size-4 text-[#CC0000]" aria-hidden="true" />
          <h2 className="text-base font-extrabold text-gray-900">Главный баннер</h2>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Постер и тексты баннера вверху главной страницы
        </p>

        <div className="mt-4 space-y-4">
          {/* Постер: живое превью как на витрине + загрузка */}
          <div>
            <Label>Постер баннера</Label>
            <div
              {...posterDropHandlers}
              className={cn(
                "relative mt-1.5 aspect-[2/1] select-none overflow-hidden rounded-xl ring-1 transition-shadow",
                dragActive ? "ring-2 ring-[#CC0000]" : "ring-gray-200",
              )}
              aria-label="Превью постера баннера — перетащите сюда файл, чтобы загрузить"
            >
              {/* blob-превью на время загрузки — без оптимизации Next */}
              <img
                key={previewSrc}
                src={previewSrc}
                alt="Постер баннера"
                draggable={false}
                className={cn("pointer-events-none size-full object-cover", posterUploading && "opacity-60")}
              />
              {/* Затемнение и надписи — как на витрине (миниатюра) */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" aria-hidden="true" />
              <div className="absolute inset-0 flex flex-col justify-center p-4 sm:p-5">
                {hero.kicker && (
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/90">
                    {hero.kicker}
                  </p>
                )}
                <p className="mt-1.5 line-clamp-2 max-w-[70%] text-sm font-extrabold leading-snug text-white sm:text-base">
                  {hero.title || "Заголовок баннера"}
                </p>
                {hero.subtitle && (
                  <p className="mt-1.5 line-clamp-2 hidden max-w-[60%] text-[11px] text-white/90 sm:block">
                    {hero.subtitle}
                  </p>
                )}
                <span className="mt-3 w-fit rounded-full bg-[#CC0000] px-4 py-1.5 text-[11px] font-bold text-white shadow-md">
                  {hero.ctaText || "Смотреть каталог"}
                </span>
              </div>
              {/* Оверлей: загрузка файла */}
              {posterUploading && (
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-white/60 text-xs font-semibold text-gray-700">
                  <Loader2 className="size-6 animate-spin text-[#CC0000]" aria-hidden="true" />
                  Загружаем постер…
                </span>
              )}
              {/* Оверлей: подсветка перетаскивания */}
              {dragActive && (
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-[#FCE8E8]/85 text-sm font-bold text-[#CC0000]">
                  <UploadCloud className="size-7" aria-hidden="true" />
                  Отпустите — загрузим постер
                </span>
              )}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={openFileDialog}
                disabled={posterUploading}
                className="rounded-full border-gray-300"
              >
                <ImagePlus className="size-4" aria-hidden="true" />
                Загрузить с компьютера
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setHero((prev) => ({ ...prev, image: DEFAULT_HERO_IMAGE }))}
                disabled={posterUploading || isDefaultPoster}
                className="rounded-full border-gray-300"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                Стандартный постер
              </Button>
              <input
                ref={fileInputRef}
                id="hero-poster-file-input"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) uploadPoster(file);
                  event.target.value = "";
                }}
              />
            </div>
            <p className="mt-1.5 text-xs text-gray-400">
              Перетащите файл прямо на превью · широкий постер 2:1 (например, 1440×720) · PNG,
              JPEG, WebP, AVIF, GIF · до 8 МБ
            </p>
          </div>

          {/* Библиотека постеров магазина */}
          <Collapsible open={libraryOpen} onOpenChange={setLibraryOpen}>
            <CollapsibleTrigger
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC0000]/40",
                !libraryOpen && "text-left",
              )}
            >
              <ChevronDown
                className={cn("size-4 shrink-0 text-gray-400 transition-transform", libraryOpen && "rotate-180")}
                aria-hidden="true"
              />
              Библиотека постеров
              <span className="ml-auto text-xs font-normal text-gray-400">
                {posters.length + 1} постера
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              {posters.length === 0 ? (
                <p className="px-2 pb-2 pt-1 text-xs text-gray-400">
                  Загруженных постеров пока нет — есть только стандартный
                </p>
              ) : (
                <div className="thin-scrollbar mt-1 grid grid-cols-2 gap-2 overflow-y-auto pb-1 pr-1 sm:grid-cols-3">
                  {/* Стандартный постер всегда первый */}
                  {[DEFAULT_HERO_IMAGE, ...posters].map((url) => {
                    const current = hero.image === url;
                    return (
                      <button
                        key={url}
                        type="button"
                        onClick={() => setHero((prev) => ({ ...prev, image: url }))}
                        aria-label={
                          current
                            ? `Текущий постер: ${url}`
                            : url === DEFAULT_HERO_IMAGE
                              ? "Выбрать стандартный постер"
                              : `Выбрать постер: ${url}`
                        }
                        className={cn(
                          "relative aspect-[2/1] overflow-hidden rounded-lg bg-[#F7F7F7] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC0000]",
                          current
                            ? "ring-2 ring-[#CC0000]"
                            : "ring-1 ring-gray-200 hover:ring-gray-400 active:scale-[0.98]",
                        )}
                      >
                        {/* Локальные пути — без оптимизации Next */}
                        <img src={url} alt="" className="size-full object-cover" loading="lazy" />
                        {url === DEFAULT_HERO_IMAGE && (
                          <span className="absolute left-1 top-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                            Стандартный
                          </span>
                        )}
                        {current && (
                          <span className="absolute inset-0 flex items-center justify-center bg-white/55">
                            <Check className="size-5 text-[#CC0000]" aria-hidden="true" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          <div>
            <Label htmlFor="hero-kicker">Надзаголовок</Label>
            <Input
              id="hero-kicker"
              value={hero.kicker}
              maxLength={60}
              onChange={(e) => setHero((prev) => ({ ...prev, kicker: e.target.value }))}
              placeholder="Неделя кукол"
              className="mt-1.5"
            />
            <p className="mt-1 text-xs text-gray-400">Оставьте пустым, чтобы скрыть</p>
          </div>
          <div>
            <Label htmlFor="hero-title">Заголовок *</Label>
            <Input
              id="hero-title"
              value={hero.title}
              maxLength={140}
              onChange={(e) => setHero((prev) => ({ ...prev, title: e.target.value }))}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="hero-subtitle">Подпись</Label>
            <Textarea
              id="hero-subtitle"
              rows={2}
              value={hero.subtitle}
              maxLength={220}
              onChange={(e) => setHero((prev) => ({ ...prev, subtitle: e.target.value }))}
              className="mt-1.5 resize-none"
            />
            <p className="mt-1 text-xs text-gray-400">Оставьте пустым, чтобы скрыть</p>
          </div>
          <div>
            <Label htmlFor="hero-cta">Текст кнопки *</Label>
            <Input
              id="hero-cta"
              value={hero.ctaText}
              maxLength={40}
              onChange={(e) => setHero((prev) => ({ ...prev, ctaText: e.target.value }))}
              className="mt-1.5"
            />
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              disabled={savingHero}
              onClick={() => void saveHero()}
              className="rounded-full bg-gray-900 text-white hover:bg-black"
            >
              {savingHero ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="size-4" aria-hidden="true" />
              )}
              Сохранить баннер
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
