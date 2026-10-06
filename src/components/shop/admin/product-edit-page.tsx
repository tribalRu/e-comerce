"use client";

// Отдельная виртуальная страница админки (в том же окне, единый роут `/`):
//   /?admin=1&edit=new  — создание товара
//   /?admin=1&edit=<id> — редактирование товара
// Форма большая и не помещается в боковую панель: слева — карточки секций
// (основная информация, цена и наличие, характеристики, менеджер фотографий),
// справа ( десктоп ) — липкий сайдбар: живой предпросмотр карточки товара на
// витрине, показ в «Хитах продаж» и кнопки Сохранить/Отмена. На мобильных —
// липкая нижняя панель с кнопками. Уход с несохранёнными изменениями —
// с подтверждением (AlertDialog).

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ImageOff,
  Loader2,
  Lock,
  PackageSearch,
  Save,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ProductCard } from "../product-card";
import { Stars } from "../stars";
import { BADGE_LABELS, pluralize } from "../utils";
import { ImageManager, uid, type ManagedImage } from "./image-manager";
import type { CategoryWithCount, Product } from "../types";

const BADGE_OPTIONS = [
  { value: "none", label: "Без метки" },
  { value: "hit", label: BADGE_LABELS.hit },
  { value: "new", label: BADGE_LABELS.new },
  { value: "sale", label: BADGE_LABELS.sale },
  { value: "deal", label: BADGE_LABELS.deal },
];

interface ProductEditPageProps {
  /** "new" — создание; число — id редактируемого товара */
  editId: "new" | number;
  categories: CategoryWithCount[];
  /** Вернуться к списку товаров (/?admin=1) */
  onBack: () => void;
  /** Товар сохранён — перечитать список в панели */
  onSaved: () => void;
}

interface FormState {
  name: string;
  brand: string;
  categoryId: string;
  price: string;
  oldPrice: string;
  stock: string;
  ageMin: string;
  description: string;
  badge: string;
  featured: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  brand: "КуклаМаркет",
  categoryId: "",
  price: "",
  oldPrice: "",
  stock: "25",
  ageMin: "3",
  description: "",
  badge: "none",
  featured: false,
};

/** Целое из строки с зажимом в диапазон (некорректное → fallback) */
function toInt(value: string, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function ProductEditPage({ editId, categories, onBack, onSaved }: ProductEditPageProps) {
  const { toast } = useToast();
  const isNew = editId === "new";

  const [loading, setLoading] = useState(!isNew);
  const [notFound, setNotFound] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  // Рейтинг и число отзывов вручную не редактируются: они будут
  // рассчитываться автоматически из реальных отзывов покупателей
  const [autoStats, setAutoStats] = useState({ rating: 0, reviewsCount: 0 });
  const [images, setImages] = useState<ManagedImage[]>([]);
  const [library, setLibrary] = useState<string[]>([]);
  const [slug, setSlug] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  // Товар для редактирования: грузим с полным набором фотографий
  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    fetch(`/api/products/${editId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("not found");
        return (await res.json()) as Product;
      })
      .then((data) => {
        if (cancelled) return;
        setForm({
          name: data.name,
          brand: data.brand,
          categoryId: String(data.categoryId),
          price: String(data.price),
          oldPrice: data.oldPrice != null ? String(data.oldPrice) : "",
          stock: String(data.stock),
          ageMin: String(data.ageMin),
          description: data.description,
          badge: data.badge ?? "none",
          featured: data.featured,
        });
        setAutoStats({ rating: data.rating, reviewsCount: data.reviewsCount });
        setImages(
          (data.images ?? []).map((image) => ({
            key: uid(),
            url: image.url,
            preview: image.url,
            isMain: image.isMain,
          })),
        );
        setSlug(data.slug);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setNotFound(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [editId, isNew]);

  // Библиотека фото магазина
  useEffect(() => {
    fetch("/api/images")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data: string[]) => setLibrary(data))
      .catch(() => {});
  }, []);

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }, []);

  // Изменения менеджера фотографий помечают форму «грязной»
  const updateImages = useCallback((action: React.SetStateAction<ManagedImage[]>) => {
    setImages(action);
    setDirty(true);
  }, []);

  const requestBack = useCallback(() => {
    if (dirty) {
      setConfirmLeave(true);
    } else {
      onBack();
    }
  }, [dirty, onBack]);

  const handleSave = async () => {
    const name = form.name.trim();
    const description = form.description.trim();
    const price = Number(form.price.replace(",", "."));
    const categoryId = Number.parseInt(form.categoryId, 10);
    const oldPriceRaw = form.oldPrice.trim();

    if (!name) {
      toast({ title: "Введите название", description: "Оно видно в каталоге и на странице товара" });
      return;
    }
    if (!description) {
      toast({ title: "Добавьте описание", description: "Описание показывается в «Об этом товаре»" });
      return;
    }
    if (!Number.isFinite(price) || price < 1) {
      toast({ title: "Укажите цену", description: "Цена — целое число в рублях" });
      return;
    }
    if (!Number.isInteger(categoryId) || categoryId < 1) {
      toast({ title: "Выберите категорию" });
      return;
    }
    if (images.length === 0) {
      toast({
        title: "Добавьте хотя бы одно фото",
        description: "Загрузите с компьютера или выберите из библиотеки магазина",
      });
      return;
    }
    if (images.some((image) => image.url === null)) {
      toast({ title: "Дождитесь окончания загрузки фото" });
      return;
    }

    let oldPrice: number | null = null;
    if (oldPriceRaw !== "") {
      const parsed = Number(oldPriceRaw.replace(",", "."));
      if (!Number.isFinite(parsed) || parsed <= price) {
        toast({
          title: "Проверьте старую цену",
          description: "Она должна быть больше текущей — или оставьте поле пустым",
        });
        return;
      }
      oldPrice = Math.round(parsed);
    }

    const payload = {
      name,
      brand: form.brand.trim() || "КуклаМаркет",
      categoryId,
      price: Math.round(price),
      oldPrice,
      stock: toInt(form.stock, 25, 0, 100_000),
      ageMin: toInt(form.ageMin, 3, 0, 18),
      // rating и reviewsCount не отправляются: рассчитываются автоматически
      // из реальных отзывов покупателей (система отзывов)
      description,
      badge: form.badge === "none" ? null : form.badge,
      featured: form.featured,
      images: images.map((image) => ({ url: image.url as string, isMain: image.isMain })),
    };

    setSaving(true);
    try {
      const res = await fetch(isNew ? "/api/products" : `/api/products/${editId}`, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setDirty(false);
        toast({
          title: isNew ? "Товар создан" : "Товар обновлён",
          description: name,
        });
        onSaved();
        onBack();
      } else {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast({
          title: "Не удалось сохранить",
          description: data?.error ?? "Проверьте поля и попробуйте ещё раз",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Не удалось сохранить",
        description: "Сервер недоступен — попробуйте ещё раз",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Живой предпросмотр карточки на витрине (из текущей формы)
  const mainImage = images.find((image) => image.isMain) ?? images[0];
  const previewProduct = useMemo<Product | null>(() => {
    if (!mainImage) return null;
    const category = categories.find((item) => item.id === Number.parseInt(form.categoryId, 10));
    const price = Number(form.price.replace(",", "."));
    const oldParsed = Number(form.oldPrice.replace(",", "."));
    const oldPrice =
      form.oldPrice.trim() !== "" && Number.isFinite(oldParsed) && oldParsed > price
        ? Math.round(oldParsed)
        : null;
    return {
      id: 0,
      slug: "",
      name: form.name.trim() || "Название товара",
      description: form.description.trim() || "Описание товара",
      price: Number.isFinite(price) && price >= 1 ? Math.round(price) : 0,
      oldPrice,
      image: mainImage.url ?? mainImage.preview,
      rating: autoStats.rating,
      reviewsCount: autoStats.reviewsCount,
      badge: form.badge === "none" ? null : form.badge,
      brand: form.brand.trim() || "КуклаМаркет",
      ageMin: toInt(form.ageMin, 3, 0, 18),
      stock: toInt(form.stock, 25, 0, 100_000),
      featured: form.featured,
      categoryId: category?.id ?? 0,
      category: {
        id: category?.id ?? 0,
        slug: category?.slug ?? "",
        name: category?.name ?? "Категория не выбрана",
      },
    };
  }, [form, mainImage, categories, autoStats]);

  // ---------- Рендер ----------

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-44" />
          </div>
        </div>
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-56 w-full rounded-xl" />
            ))}
          </div>
          <Skeleton className="hidden h-96 w-full rounded-xl lg:block" />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-300 py-16 text-center">
        <PackageSearch className="size-12 text-gray-300" aria-hidden="true" />
        <p className="text-base font-bold text-gray-900">Товар не найден</p>
        <p className="max-w-xs text-sm text-gray-500">
          Возможно, он был удалён. Вернитесь к списку и обновите его.
        </p>
        <Button type="button" variant="outline" onClick={onBack} className="mt-1 rounded-full">
          <ArrowLeft className="size-4" aria-hidden="true" />
          К списку товаров
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Шапка страницы */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={requestBack}
          className="rounded-full border-gray-300"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          К списку товаров
        </Button>
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight text-gray-900 sm:text-2xl">
            {isNew ? "Новый товар" : "Редактирование товара"}
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {isNew
              ? "Заполните карточку — товар сразу появится на витрине"
              : slug
                ? `ID ${editId} · /${slug}`
                : `ID ${editId}`}
          </p>
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Левая колонка — секции формы */}
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Основная информация</CardTitle>
              <CardDescription>Название, категория и описание на странице товара</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="pe-name">Название *</Label>
                <Input
                  id="pe-name"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Например: Кукла «София» с набором аксессуаров"
                  className="mt-1.5"
                  maxLength={200}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="pe-brand">Бренд</Label>
                  <Input
                    id="pe-brand"
                    value={form.brand}
                    onChange={(e) => set("brand", e.target.value)}
                    className="mt-1.5"
                    maxLength={80}
                  />
                </div>
                <div>
                  <Label htmlFor="pe-category">Категория *</Label>
                  <Select value={form.categoryId} onValueChange={(value) => set("categoryId", value)}>
                    <SelectTrigger id="pe-category" className="mt-1.5 w-full">
                      <SelectValue placeholder="Выберите категорию" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={String(category.id)}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="pe-description">Описание *</Label>
                <Textarea
                  id="pe-description"
                  rows={6}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="Расскажите про куклу: что в комплекте, чем особенна, кому подойдёт…"
                  className="mt-1.5 resize-y"
                  maxLength={2000}
                />
                <p className="mt-1.5 text-xs text-gray-400">
                  {form.description.length} / 2000 символов
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Цена и наличие</CardTitle>
              <CardDescription>
                Старая цена показывается зачёркнутой — скидка считается автоматически
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <Label htmlFor="pe-price">Цена, ₽ *</Label>
                  <Input
                    id="pe-price"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={form.price}
                    onChange={(e) => set("price", e.target.value)}
                    placeholder="3499"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="pe-oldprice">Старая цена, ₽</Label>
                  <Input
                    id="pe-oldprice"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={form.oldPrice}
                    onChange={(e) => set("oldPrice", e.target.value)}
                    placeholder="Не указана"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="pe-stock">Остаток, шт.</Label>
                  <Input
                    id="pe-stock"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={form.stock}
                    onChange={(e) => set("stock", e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="pe-age">Возраст от, лет</Label>
                  <Input
                    id="pe-age"
                    type="number"
                    min={0}
                    max={18}
                    inputMode="numeric"
                    value={form.ageMin}
                    onChange={(e) => set("ageMin", e.target.value)}
                    className="mt-1.5"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Характеристики и метка</CardTitle>
              <CardDescription>
                Метка показывается на карточке; рейтинг и отзывы заполняются
                автоматически из отзывов покупателей
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="pe-badge">Метка на карточке</Label>
                  <Select value={form.badge} onValueChange={(value) => set("badge", value)}>
                    <SelectTrigger id="pe-badge" className="mt-1.5 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BADGE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Label>Рейтинг и отзывы</Label>
                  <div
                    className="mt-1.5 flex h-9 items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 text-sm text-gray-600"
                    aria-label="Рейтинг и количество отзывов — заполняются автоматически"
                  >
                    {autoStats.reviewsCount > 0 ? (
                      <>
                        <Stars rating={autoStats.rating} />
                        <span className="font-semibold text-gray-800">
                          {autoStats.rating.toFixed(1)}
                        </span>
                        <span className="text-gray-500">
                          {autoStats.reviewsCount}{" "}
                          {pluralize(autoStats.reviewsCount, "отзыв", "отзыва", "отзывов")}
                        </span>
                      </>
                    ) : (
                      <span>Пока нет отзывов</span>
                    )}
                    <Lock
                      className="ml-auto size-3.5 shrink-0 text-gray-400"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-1.5 text-xs leading-snug text-gray-400">
                    Рассчитывается автоматически из реальных оценок и отзывов
                    покупателей — вручную не редактируется
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Фотографии *</CardTitle>
              <CardDescription>
                Загрузите с компьютера или выберите из библиотеки. Порядок меняется
                перетаскиванием, звёздочкой назначается главная — она показывается
                на карточке товара
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ImageManager images={images} setImages={updateImages} library={library} />
            </CardContent>
          </Card>
        </div>

        {/* Правый сайдбар (десктоп): предпросмотр + показ на витрине + сохранение */}
        <aside className="space-y-5 lg:sticky lg:top-24">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Как выглядит на витрине</CardTitle>
              <CardDescription>Живой предпросмотр карточки товара</CardDescription>
            </CardHeader>
            <CardContent>
              {previewProduct ? (
                <ProductCard
                  product={previewProduct}
                  onOpen={() => {}}
                  onAdd={() => {}}
                  canAdd={false}
                />
              ) : (
                <div className="flex aspect-square w-full max-w-[220px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-[#F9F9F9] text-center">
                  <ImageOff className="size-8 text-gray-300" aria-hidden="true" />
                  <p className="max-w-[180px] text-xs text-gray-400">
                    Добавьте фото — здесь появится предпросмотр карточки
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Показ на витрине</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">Хиты продаж</p>
                  <p className="mt-0.5 text-xs text-gray-500">Товар попадёт в карусель на главной</p>
                </div>
                <Switch
                  checked={form.featured}
                  onCheckedChange={(value) => set("featured", value)}
                  aria-label="Показывать в хитах продаж"
                />
              </div>
              <p className="mt-4 text-xs text-gray-400">
                Товар сразу виден в каталоге и по прямой ссылке. Slug генерируется из названия
                автоматически.
              </p>
            </CardContent>
          </Card>

          {/* Кнопки сайдбара — только десктоп (на мобильных липкая нижняя панель) */}
          <div className="hidden flex-col gap-2.5 rounded-xl border border-gray-200 bg-white p-4 lg:flex">
            <Button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="w-full rounded-full bg-[#CC0000] text-white hover:bg-[#A80000]"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Сохраняем…
                </>
              ) : (
                <>
                  <Save className="size-4" aria-hidden="true" />
                  {isNew ? "Создать товар" : "Сохранить изменения"}
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={requestBack}
              className="w-full rounded-full"
            >
              Отмена
            </Button>
          </div>
        </aside>
      </div>

      {/* Мобильная липкая панель сохранения */}
      <div className="sticky bottom-0 -mx-4 z-30 mt-6 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:px-5 lg:hidden">
        <div className="flex gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={requestBack}
            className="flex-1 rounded-full"
          >
            Отмена
          </Button>
          <Button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="flex-[2] rounded-full bg-[#CC0000] text-white hover:bg-[#A80000]"
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Сохраняем…
              </>
            ) : isNew ? (
              "Создать товар"
            ) : (
              "Сохранить"
            )}
          </Button>
        </div>
      </div>

      {/* Уход с несохранёнными изменениями */}
      <AlertDialog open={confirmLeave} onOpenChange={(open) => !open && setConfirmLeave(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Уйти без сохранения?</AlertDialogTitle>
            <AlertDialogDescription>
              У товара есть несохранённые изменения — они будут потеряны, если покинуть страницу.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Остаться</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmLeave(false);
                setDirty(false);
                onBack();
              }}
              className="bg-[#CC0000] text-white hover:bg-[#A80000]"
            >
              Уйти
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
