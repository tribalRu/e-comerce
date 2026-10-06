"use client";

// Раздел «Категории» админ-панели:
//   • список категорий каталога: порядок стрелками вверх/вниз (PUT /api/categories
//     { order } — вся последовательность одним запросом), количество товаров;
//   • создание — диалог: название + адрес (slug; генерируется из названия
//     транслитерацией, можно поправить);
//   • редактирование — диалог: название и адрес (slug) категории;
//   • удаление — только пустых категорий (с подтверждением; сервер тоже
//     отклонит категорию с товарами).
// После любого изменения родитель перечитывает категории и товары (в строках
// товаров вложены названия категорий).

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  Plus,
  Tags,
  Trash2,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { pluralize } from "../utils";
import type { CategoryWithCount } from "../types";

/** Русско-латинская транслитерация для генерации адреса (как на сервере) */
const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh",
  щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

/** Адрес (slug) из названия: транслитерация RU→EN, только a-z0-9 и дефисы */
function slugifyClient(name: string): string {
  return name
    .toLowerCase()
    .split("")
    .map((char) => (TRANSLIT[char] !== undefined ? TRANSLIT[char] : char))
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

interface CategoriesTabProps {
  categories: CategoryWithCount[] | null;
  /** перечитать категории и товары в панели */
  onChanged: () => void;
}

export function CategoriesTab({ categories, onChanged }: CategoriesTabProps) {
  const { toast } = useToast();

  // Диалог создания/редактирования
  const [dialog, setDialog] = useState<null | { id: number | null; name: string; slug: string }>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  // Удаление и переупорядочивание
  const [deleting, setDeleting] = useState<CategoryWithCount | null>(null);
  const [reordering, setReordering] = useState(false);

  // При закрытии диалога сбрасываем флаг «slug правили вручную»
  useEffect(() => {
    if (dialog === null) setSlugTouched(false);
  }, [dialog]);

  const list = categories ?? null;

  // ---------- Создание / редактирование ----------

  const openCreate = () => setDialog({ id: null, name: "", slug: "" });

  const openEdit = (category: CategoryWithCount) =>
    setDialog({ id: category.id, name: category.name, slug: category.slug });

  const setDialogName = (value: string) => {
    setDialog((prev) => {
      if (!prev) return prev;
      // slug перегенерируется из названия, пока его не правили вручную
      const slug = slugTouched ? prev.slug : slugifyClient(value);
      return { ...prev, name: value, slug };
    });
  };

  const submitDialog = async () => {
    if (!dialog) return;
    const name = dialog.name.trim();
    if (!name) {
      toast({ title: "Введите название", description: "Название видно на витрине и в фильтрах" });
      return;
    }
    const slug = dialog.slug.trim();
    if (dialog.id === null && slugTouched && !SLUG_PATTERN.test(slug)) {
      toast({
        title: "Проверьте адрес категории",
        description: "Только строчные латинские буквы, цифры и дефисы — например, kollektsionnye",
      });
      return;
    }

    setSaving(true);
    try {
      const isNew = dialog.id === null;
      const res = await fetch(isNew ? "/api/categories" : `/api/categories/${dialog.id}`, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isNew
            ? { name, ...(slugTouched ? { slug } : {}) }
            : { name, ...(slug !== dialog.slug || slugTouched ? { slug } : {}) },
        ),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "");
      }
      toast({
        title: isNew ? "Категория создана" : "Категория обновлена",
        description: name,
      });
      setDialog(null);
      onChanged();
    } catch (error) {
      toast({
        title: "Не удалось сохранить",
        description:
          error instanceof Error && error.message ? error.message : "Попробуйте ещё раз",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // ---------- Порядок (стрелки) ----------

  const move = async (index: number, direction: -1 | 1) => {
    if (!list || reordering) return;
    const target = index + direction;
    if (target < 0 || target >= list.length) return;

    // Новая последовательность id — целиком одним запросом
    const order = [...list.map((category) => category.id)];
    [order[index], order[target]] = [order[target], order[index]];

    setReordering(true);
    try {
      const res = await fetch("/api/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "");
      }
      onChanged();
    } catch (error) {
      toast({
        title: "Не удалось изменить порядок",
        description:
          error instanceof Error && error.message ? error.message : "Попробуйте ещё раз",
        variant: "destructive",
      });
    } finally {
      setReordering(false);
    }
  };

  // ---------- Удаление ----------

  const confirmDelete = async () => {
    const category = deleting;
    if (!category) return;
    setDeleting(null);
    try {
      const res = await fetch(`/api/categories/${category.id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Категория удалена", description: category.name });
        onChanged();
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

  const dialogSlugHint = useMemo(() => {
    if (!dialog) return "";
    return "Адрес виден в фильтрах витрины; генерируется из названия автоматически";
  }, [dialog]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-extrabold text-gray-900">Категории каталога</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Название, адрес и порядок — как их видит покупатель на витрине
          </p>
        </div>
        <Button
          type="button"
          onClick={openCreate}
          className="ml-auto h-10 rounded-full bg-[#CC0000] px-4 text-white hover:bg-[#A80000]"
        >
          <Plus className="size-4" aria-hidden="true" />
          Добавить категорию
        </Button>
      </div>

      <div className="mt-4">
        {list === null ? (
          <div className="space-y-2.5">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-300 py-12 text-center">
            <Tags className="size-10 text-gray-300" aria-hidden="true" />
            <p className="text-sm font-bold text-gray-900">Категорий пока нет</p>
            <p className="max-w-xs text-xs text-gray-500">
              Добавьте первую — она появится в фильтрах витрины и в карточках товаров
            </p>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-gray-100">
              {list.map((category, index) => (
                <li key={category.id} className="flex items-center gap-2 py-3 sm:gap-3">
                  {/* Порядок: стрелки вверх/вниз */}
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => void move(index, -1)}
                      disabled={index === 0 || reordering}
                      aria-label={`Переместить «${category.name}» выше`}
                      className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC0000]/40"
                    >
                      <ChevronUp className="size-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void move(index, 1)}
                      disabled={index === list.length - 1 || reordering}
                      aria-label={`Переместить «${category.name}» ниже`}
                      className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC0000]/40"
                    >
                      <ChevronDown className="size-4" aria-hidden="true" />
                    </button>
                  </div>

                  <span className="hidden w-8 shrink-0 text-center text-xs font-semibold tabular-nums text-gray-300 sm:block">
                    {index + 1}
                  </span>

                  {/* Название + адрес */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">{category.name}</p>
                    <p className="mt-0.5 truncate font-mono text-xs text-gray-400">/{category.slug}</p>
                  </div>

                  {/* Счётчик товаров */}
                  <span
                    className={cn(
                      "inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold leading-none",
                      category.count === 0 ? "bg-gray-100 text-gray-400" : "bg-[#FCE8E8] text-[#CC0000]",
                    )}
                    title={category.count === 0 ? "Пустая категория" : ""}
                  >
                    {category.count}{" "}
                    {pluralize(category.count, "товар", "товара", "товаров").toLowerCase()}
                  </span>

                  {/* Действия */}
                  <div className="flex shrink-0 justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(category)}
                      aria-label={`Редактировать: ${category.name}`}
                      className="size-9 rounded-full text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (category.count > 0) {
                          toast({
                            title: "Категория не пустая",
                            description: `В «${category.name}» ${category.count} ${pluralize(
                              category.count,
                              "товар",
                              "товара",
                              "товаров",
                            ).toLowerCase()} — сначала перенесите или удалите их`,
                          });
                          return;
                        }
                        setDeleting(category);
                      }}
                      aria-label={
                        category.count > 0
                          ? `Категория «${category.name}» содержит товары — удаление недоступно`
                          : `Удалить: ${category.name}`
                      }
                      className={cn(
                        "size-9 rounded-full text-[#CC0000] hover:bg-[#FCE8E8] hover:text-[#A80000]",
                        category.count > 0 && "text-gray-300 hover:bg-transparent hover:text-gray-300",
                      )}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            <p className="mt-3 text-xs text-gray-400" aria-live="polite">
              {list.length}{" "}
              {pluralize(list.length, "категория", "категории", "категорий").toLowerCase()} ·
              стрелки меняют порядок на витрине · удалить можно только пустую
            </p>
          </>
        )}
      </div>

      {/* Диалог создания/редактирования категории */}
      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialog?.id === null || dialog === null ? "Новая категория" : "Редактирование категории"}
            </DialogTitle>
            <DialogDescription>
              Категория сразу появляется в фильтрах витрины и у товаров
            </DialogDescription>
          </DialogHeader>
          {dialog && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="category-name">Название *</Label>
                <Input
                  id="category-name"
                  value={dialog.name}
                  maxLength={60}
                  onChange={(e) => setDialogName(e.target.value)}
                  placeholder="Например, Наборы для творчества"
                  className="mt-1.5"
                  autoFocus
                />
              </div>
              <div>
                <Label htmlFor="category-slug">Адрес (slug)</Label>
                <Input
                  id="category-slug"
                  value={dialog.slug}
                  maxLength={60}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setDialog((prev) => (prev ? { ...prev, slug: e.target.value } : prev));
                  }}
                  placeholder="nabory-dlya-tvorchestva"
                  className="mt-1.5 font-mono text-sm"
                  aria-describedby="category-slug-hint"
                />
                <p id="category-slug-hint" className="mt-1 text-xs text-gray-400">
                  {dialogSlugHint}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialog(null)}
              className="rounded-full border-gray-300"
            >
              Отмена
            </Button>
            <Button
              type="button"
              disabled={saving}
              onClick={() => void submitDialog()}
              className="rounded-full bg-[#CC0000] text-white hover:bg-[#A80000]"
            >
              {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {dialog?.id === null || dialog === null ? "Создать" : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Подтверждение удаления пустой категории */}
      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить категорию?</AlertDialogTitle>
            <AlertDialogDescription>
              «{deleting?.name}» исчезнет с витрины. Категория пустая, поэтому товары не
              затронутся. Действие необратимо.
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
