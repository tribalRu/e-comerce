"use client";

// Админ-панель «КуклаМаркет» — виртуальные роуты на единственном URL `/`:
//   /?admin=1            — панель: «Товары» (таблица: поиск, удаление с подтверждением),
//                          «Категории» (создание, правка, порядок, удаление пустых)
//                          и «Функционал и баннер» (переключатели + постер и тексты hero)
//   /?admin=1&edit=new   — отдельная страница создания товара (ProductEditPage)
//   /?admin=1&edit=<id>  — отдельная страница редактирования товара
// Создание/редактирование — полноэкранная страница с большим набором полей и
// менеджером фотографий (загрузка с компьютера, порядок, главная фото).
// Все данные — через API: /api/products, /api/categories, /api/settings.
// Изменения сразу применяются на витрине (она перечитывает их после возврата).

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, PackageSearch, Pencil, Plus, Search, Star, Trash2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { BullseyeLogo } from "../logo";
import { CategoriesTab } from "./categories-tab";
import { ProductEditPage } from "./product-edit-page";
import { StoreSettingsTab } from "./settings-tab";
import { BADGE_LABELS, formatPrice, pluralize } from "../utils";
import type { CategoryWithCount, Product, SiteSettings } from "../types";

const BADGE_CHIP_STYLES: Record<string, string> = {
  hit: "bg-[#FCE8E8] text-[#CC0000]",
  new: "bg-emerald-50 text-emerald-700",
  sale: "bg-gray-100 text-gray-700",
  deal: "bg-gray-900 text-white",
};

interface AdminPanelProps {
  /** null — список (панель); "new" | id — открыт редактор товара */
  editTarget: "new" | number | null;
  onExit: () => void;
}

export function AdminPanel({ editTarget, onExit }: AdminPanelProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [categories, setCategories] = useState<CategoryWithCount[] | null>(null);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [query, setQuery] = useState("");
  const [deleting, setDeleting] = useState<Product | null>(null);

  const loadProducts = useCallback(() => {
    fetch("/api/products?sort=new")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data: Product[]) => setProducts(data))
      .catch(() => setProducts([]));
  }, []);

  const loadSettings = useCallback(() => {
    fetch("/api/settings")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data: SiteSettings) => setSettings(data))
      .catch(() => {});
  }, []);

  const loadCategories = useCallback(() => {
    fetch("/api/categories")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data: CategoryWithCount[]) => setCategories(data))
      .catch(() => setCategories([]));
  }, []);

  // Категории изменились (создание/правка/порядок/удаление): перечитываем их и
  // товары — в строках товаров вложены названия категорий
  const handleCategoriesChanged = useCallback(() => {
    loadCategories();
    loadProducts();
  }, [loadCategories, loadProducts]);

  useEffect(() => {
    loadProducts();
    loadSettings();
    loadCategories();
  }, [loadProducts, loadSettings, loadCategories]);

  // Заголовок вкладки — режим админки (восстанавливаем при уходе); редактор
  // товара задаёт свой титул здесь же (единая точка управления)
  useEffect(() => {
    const previous = document.title;
    document.title =
      editTarget === null
        ? "Админ-панель — КуклаМаркет"
        : editTarget === "new"
          ? "Новый товар — КуклаМаркет"
          : "Редактирование товара — КуклаМаркет";
    return () => {
      document.title = previous;
    };
  }, [editTarget]);

  const filtered = useMemo(() => {
    if (products === null) return null;
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(q) || product.brand.toLowerCase().includes(q),
    );
  }, [products, query]);

  const confirmDelete = async () => {
    const product = deleting;
    if (!product) return;
    setDeleting(null);
    try {
      const res = await fetch(`/api/products/${product.id}`, { method: "DELETE" });
      if (res.ok) {
        setProducts((list) => (list ? list.filter((item) => item.id !== product.id) : list));
        toast({ title: "Товар удалён", description: product.name });
      } else {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast({
          title: "Не удалось удалить",
          description: data?.error ?? "Попробуйте ещё раз",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Не удалось удалить",
        description: "Сервер недоступен — попробуйте ещё раз",
        variant: "destructive",
      });
    }
  };

  // Навигация по виртуальным роутам админки (работают Назад/Вперёд браузера)
  const goList = useCallback(() => router.push("/?admin=1"), [router]);
  const goCreate = useCallback(() => router.push("/?admin=1&edit=new"), [router]);
  const goEdit = useCallback(
    (product: Product) => router.push(`/?admin=1&edit=${product.id}`),
    [router],
  );

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F7F7]">
      <header className="sticky top-0 z-40 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.08)]">
        <div className="h-3 bg-[#CC0000]" aria-hidden="true" />
        <div className="shop-container flex h-16 items-center gap-3">
          <button
            type="button"
            onClick={onExit}
            aria-label="КуклаМаркет — вернуться на витрину"
            className="flex shrink-0 items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC0000]/30"
          >
            <BullseyeLogo className="size-9 sm:size-10" />
          </button>
          <div className="min-w-0">
            <p className="text-sm font-extrabold leading-tight text-gray-900">КуклаМаркет</p>
            <p className="text-xs text-gray-500">Управление магазином</p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={onExit}
            className="ml-auto rounded-full border-gray-300"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            На витрину
          </Button>
        </div>
      </header>

      <main className="shop-container flex-1 pb-10 pt-6 sm:pt-8">
        {editTarget !== null ? (
          <ProductEditPage
            editId={editTarget}
            categories={categories ?? []}
            onBack={goList}
            onSaved={loadProducts}
          />
        ) : (
          <>
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Админ-панель</h1>
            <p className="mt-1 text-sm text-gray-500">
              Товары, категории, функционал витрины и главный баннер — изменения применяются
              сразу
            </p>

            <Tabs defaultValue="products" className="mt-6">
              <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-full bg-[#EBEBEB] p-1 sm:w-auto">
                <TabsTrigger
                  value="products"
                  className="rounded-full px-4 py-2 text-sm font-semibold data-[state=active]:bg-white"
                >
                  Товары
                </TabsTrigger>
                <TabsTrigger
                  value="features"
                  className="rounded-full px-4 py-2 text-sm font-semibold data-[state=active]:bg-white"
                >
                  Функционал и баннер
                </TabsTrigger>
                <TabsTrigger
                  value="categories"
                  className="rounded-full px-4 py-2 text-sm font-semibold data-[state=active]:bg-white"
                >
                  Категории
                </TabsTrigger>
              </TabsList>

              {/* ============ Товары ============ */}
              <TabsContent value="products" className="mt-5">
                <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative w-full min-w-0 max-w-sm flex-1">
                      <Search
                        className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400"
                        aria-hidden="true"
                      />
                      <label htmlFor="admin-products-search" className="sr-only">
                        Поиск товаров
                      </label>
                      <Input
                        id="admin-products-search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Поиск по названию или бренду"
                        className="h-10 rounded-full border-transparent bg-[#F7F7F7] pl-9 text-sm"
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={goCreate}
                      className="ml-auto h-10 rounded-full bg-[#CC0000] px-4 text-white hover:bg-[#A80000]"
                    >
                      <Plus className="size-4" aria-hidden="true" />
                      Добавить товар
                    </Button>
                  </div>

                  <div className="mt-4">
                    {filtered === null ? (
                      <div className="space-y-2.5">
                        {Array.from({ length: 6 }, (_, index) => (
                          <Skeleton key={index} className="h-14 w-full rounded-lg" />
                        ))}
                      </div>
                    ) : filtered.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-300 py-12 text-center">
                        <PackageSearch className="size-10 text-gray-300" aria-hidden="true" />
                        <p className="text-sm font-bold text-gray-900">
                          {query ? "Ничего не нашлось" : "Товаров пока нет"}
                        </p>
                        <p className="max-w-xs text-xs text-gray-500">
                          {query
                            ? "Попробуйте изменить запрос."
                            : "Добавьте первый товар — он сразу появится на витрине."}
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-lg border border-gray-200">
                        <div className="thin-scrollbar max-h-[65vh] overflow-y-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="hover:bg-transparent">
                                <TableHead className="w-[72px]">Фото</TableHead>
                                <TableHead>Название</TableHead>
                                <TableHead className="hidden md:table-cell">Категория</TableHead>
                                <TableHead>Цена</TableHead>
                                <TableHead className="hidden sm:table-cell">Остаток</TableHead>
                                <TableHead className="hidden lg:table-cell">Метка</TableHead>
                                <TableHead className="hidden w-[64px] lg:table-cell">Хит</TableHead>
                                <TableHead className="w-[104px] text-right">Действия</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filtered.map((product) => (
                                <TableRow key={product.id} className="cursor-default">
                                  <TableCell>
                                    <div className="relative size-12 overflow-hidden rounded-lg bg-[#F7F7F7] ring-1 ring-gray-200/70">
                                      <Image
                                        src={product.image}
                                        alt=""
                                        fill
                                        sizes="48px"
                                        unoptimized
                                        className="object-cover"
                                      />
                                    </div>
                                  </TableCell>
                                  <TableCell className="max-w-[220px] sm:max-w-[280px]">
                                    <p className="truncate text-sm font-semibold text-gray-900">
                                      {product.name}
                                    </p>
                                    <p className="mt-0.5 truncate text-xs text-gray-500">
                                      {product.brand}
                                    </p>
                                  </TableCell>
                                  <TableCell className="hidden text-sm text-gray-600 md:table-cell">
                                    {product.category.name}
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap">
                                    <p className="text-sm font-bold text-gray-900">
                                      {formatPrice(product.price)}
                                    </p>
                                    {product.oldPrice ? (
                                      <p className="text-xs text-gray-400 line-through">
                                        {formatPrice(product.oldPrice)}
                                      </p>
                                    ) : null}
                                  </TableCell>
                                  <TableCell className="hidden sm:table-cell">
                                    <span
                                      className={cn(
                                        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold leading-none",
                                        product.stock === 0
                                          ? "bg-[#FCE8E8] text-[#CC0000]"
                                          : product.stock <= 12
                                            ? "bg-amber-50 text-amber-700"
                                            : "bg-gray-100 text-gray-600",
                                      )}
                                    >
                                      {product.stock === 0 ? "Нет в наличии" : `${product.stock} шт.`}
                                    </span>
                                  </TableCell>
                                  <TableCell className="hidden lg:table-cell">
                                    {product.badge ? (
                                      <span
                                        className={cn(
                                          "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold leading-none",
                                          BADGE_CHIP_STYLES[product.badge] ?? "bg-gray-100 text-gray-600",
                                        )}
                                      >
                                        {BADGE_LABELS[product.badge] ?? product.badge}
                                      </span>
                                    ) : (
                                      <span className="text-xs text-gray-300">—</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="hidden lg:table-cell">
                                    {product.featured ? (
                                      <Star
                                        className="size-4 fill-amber-400 text-amber-400"
                                        aria-label="Показывается в хитах продаж"
                                      />
                                    ) : (
                                      <span className="text-xs text-gray-300">—</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => goEdit(product)}
                                        aria-label={`Редактировать: ${product.name}`}
                                        className="size-9 rounded-full text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                                      >
                                        <Pencil className="size-4" aria-hidden="true" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setDeleting(product)}
                                        aria-label={`Удалить: ${product.name}`}
                                        className="size-9 rounded-full text-[#CC0000] hover:bg-[#FCE8E8] hover:text-[#A80000]"
                                      >
                                        <Trash2 className="size-4" aria-hidden="true" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </div>

                  <p className="mt-3 text-xs text-gray-400" aria-live="polite">
                    {filtered === null
                      ? "Загружаем…"
                      : `${filtered.length} ${pluralize(filtered.length, "товар", "товара", "товаров")}`}{" "}
                    · изменения сразу видны на витрине
                  </p>
                </div>
              </TabsContent>

              {/* ============ Функционал и баннер ============ */}
              <TabsContent value="features" className="mt-5">
                <StoreSettingsTab settings={settings} onSaved={loadSettings} />
              </TabsContent>

              {/* ============ Категории ============ */}
              <TabsContent value="categories" className="mt-5">
                <CategoriesTab categories={categories} onChanged={handleCategoriesChanged} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>

      <footer className="mt-auto border-t border-gray-200 bg-white">
        <div className="shop-container flex flex-wrap items-center justify-between gap-2 py-4 text-xs text-gray-400">
          <span>Админ-панель КуклаМаркет · демо-режим без авторизации</span>
          <button
            type="button"
            onClick={onExit}
            className="rounded-sm font-medium text-gray-500 transition-colors hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC0000]/30"
          >
            Вернуться в магазин →
          </button>
        </div>
      </footer>

      {/* Подтверждение удаления */}
      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить товар?</AlertDialogTitle>
            <AlertDialogDescription>
              «{deleting?.name}» исчезнет из каталога и с витрины. Действие необратимо.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmDelete()}
              className="bg-[#CC0000] text-white hover:bg-[#A80000]"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
