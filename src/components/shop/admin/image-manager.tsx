"use client";

// Менеджер фотографий товара для страницы редактирования (CMS):
//   • загрузка с компьютера — кнопкой «Выбрать файлы» (диалог) и перетаскиванием
//     файлов на зону (drag-and-drop с подсветкой активной зоны);
//   • во время загрузки — локальное превью (blob:) со спиннером, файлы грузятся
//     параллельно через POST /api/upload;
//   • порядок фотографий меняется перетаскиванием плиток (dnd-kit, мышь и клавиатура);
//   • главная фотография (показывается на карточке товара) назначается «звёздочкой»;
//   • удаление — крестиком; если удалена главная — главной становится первая;
//   • «Добавить из библиотеки» — выбор из уже загруженных фото магазина (/api/images).
//
// Состояние списка живёт в родителе (странице редактора): сюда передаётся
// setImages (обёртка, помечающая форму «грязной»). Инвариант: ровно одна
// isMain=true, пока список не пуст.

import { useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  GripVertical,
  ImagePlus,
  Loader2,
  Star,
  Trash2,
  UploadCloud,
} from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/** Максимум фотографий у товара (валидация сервера — 12) */
const MAX_IMAGES = 12;

/** Максимальный размер файла (валидация сервера — 8 МБ) */
const MAX_FILE_SIZE = 8 * 1024 * 1024;

/** Допустимые MIME-типы загрузки (контракт POST /api/upload) */
const ACCEPTED_MIME = ["image/png", "image/jpeg", "image/webp", "image/avif", "image/gif"];

/** Одна фотография в списке менеджера */
export interface ManagedImage {
  /** Стабильный ключ для dnd-kit и обновления записи при загрузке */
  key: string;
  /** Серверный путь ("/images/...") после загрузки; null — загрузка в полёте */
  url: string | null;
  /** Превью: blob: во время загрузки или путь на сервере */
  preview: string;
  isMain: boolean;
}

/** Уникальный ключ без зависимости от crypto.randomUUID (не secure context) */
export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

interface ImageManagerProps {
  images: ManagedImage[];
  /** Сеттер родителя (в т.ч. функциональные обновления) — помечает форму изменённой */
  setImages: (action: React.SetStateAction<ManagedImage[]>) => void;
  /** Доступные фото магазина из GET /api/images */
  library: string[];
}

export function ImageManager({ images, setImages, library }: ImageManagerProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const dragDepth = useRef(0);
  const [libraryOpen, setLibraryOpen] = useState(false);

  // Датчики сортировки: мышь/палец (после смещения 6px — клики по кнопкам работают)
  // и клавиатура (Space — взять, стрелки — переместить, Space — положить)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const uploadingCount = images.filter((image) => image.url === null).length;
  const mainIndex = images.findIndex((image) => image.isMain);

  // ---------- Загрузка файлов с компьютера (диалог и перетаскивание) ----------

  const uploadFiles = (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const supported = files.filter((file) => ACCEPTED_MIME.includes(file.type));
    if (supported.length < files.length) {
      toast({
        title: "Некоторые файлы пропущены",
        description: "Поддерживаются PNG, JPEG, WebP, AVIF и GIF",
      });
    }

    const fitting = supported.filter((file) => file.size <= MAX_FILE_SIZE);
    if (fitting.length < supported.length) {
      toast({
        title: "Файлы больше 8 МБ пропущены",
        description: "Уменьшите размер фото перед загрузкой",
      });
    }

    const space = MAX_IMAGES - images.length;
    if (space <= 0) {
      toast({ title: "Лимит фотографий", description: `У товара может быть не больше ${MAX_IMAGES} фото` });
      return;
    }
    const accepted = fitting.slice(0, space);
    if (accepted.length < fitting.length) {
      toast({
        title: "Часть фото не добавлена",
        description: `Можно добавить ещё ${space} ${space === 1 ? "фотографию" : "фотографий"}`,
      });
    }
    if (accepted.length === 0) return;

    // Оптимистичные записи: локальное превью + статус «загружается» (url === null)
    const entries: ManagedImage[] = accepted.map((file) => ({
      key: uid(),
      url: null,
      preview: URL.createObjectURL(file),
      isMain: false,
    }));
    setImages((prev) => {
      const next = [...prev, ...entries];
      // Первое фото автоматически становится главным
      if (next.length > 0 && !next.some((image) => image.isMain)) {
        next[0] = { ...next[0], isMain: true };
      }
      return next;
    });

    // Параллельная загрузка; каждая плитка обновляется по своему ключу
    accepted.forEach((file, index) => {
      const entry = entries[index];
      const body = new FormData();
      body.append("file", file);
      fetch("/api/upload", { method: "POST", body })
        .then(async (res) => {
          const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
          if (!res.ok || !data?.url) {
            throw new Error(data?.error ?? "Сервер недоступен");
          }
          return data.url;
        })
        .then((url) => {
          setImages((prev) =>
            prev.map((image) =>
              image.key === entry.key ? { ...image, url, preview: url } : image,
            ),
          );
          // blob-превью больше не нужно — освобождаем с запасом на перерисовку
          window.setTimeout(() => URL.revokeObjectURL(entry.preview), 1500);
        })
        .catch((error: unknown) => {
          const reason = error instanceof Error ? error.message : "Попробуйте ещё раз";
          setImages((prev) => prev.filter((image) => image.key !== entry.key));
          URL.revokeObjectURL(entry.preview);
          toast({
            title: "Фото не загрузилось",
            description: `${file.name || "Файл"} — ${reason}`,
            variant: "destructive",
          });
        });
    });
  };

  const openFileDialog = () => inputRef.current?.click();

  // ---------- Сортировка перетаскиванием (dnd-kit) ----------

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setImages((prev) => {
      const from = prev.findIndex((image) => image.key === active.id);
      const to = prev.findIndex((image) => image.key === over.id);
      if (from < 0 || to < 0) return prev;
      return arrayMove(prev, from, to);
    });
  };

  // ---------- Действия с отдельной фотографией ----------

  const makeMain = (key: string) => {
    setImages((prev) => prev.map((image) => ({ ...image, isMain: image.key === key })));
  };

  const removeImage = (key: string) => {
    setImages((prev) => {
      const target = prev.find((image) => image.key === key);
      if (target?.preview.startsWith("blob:")) URL.revokeObjectURL(target.preview);
      const next = prev.filter((image) => image.key !== key);
      // Удалена главная — главной становится первая оставшаяся
      if (next.length > 0 && !next.some((image) => image.isMain)) {
        next[0] = { ...next[0], isMain: true };
      }
      return next;
    });
  };

  // ---------- Библиотека магазина ----------

  const addFromLibrary = (url: string) => {
    if (images.some((image) => image.url === url)) return;
    if (images.length >= MAX_IMAGES) {
      toast({ title: "Лимит фотографий", description: `У товара может быть не больше ${MAX_IMAGES} фото` });
      return;
    }
    setImages((prev) => {
      const next = [...prev, { key: uid(), url, preview: url, isMain: false }];
      if (next.length === 1) next[0].isMain = true;
      return next;
    });
  };

  // Общие обработки drop-зоны: вся секция — цель перетаскивания файлов
  const dropHandlers = {
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
      if (!event.dataTransfer?.files?.length) return;
      event.preventDefault();
      dragDepth.current = 0;
      setDragActive(false);
      uploadFiles(event.dataTransfer.files);
    },
  };

  return (
    <div {...dropHandlers} className="select-none">
      {/* Зона загрузки: клик/кнопка — диалог, перетаскивание файлов — drop */}
      <div
        onClick={openFileDialog}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openFileDialog();
          }
        }}
        aria-label="Загрузить фото с компьютера"
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC0000]/40",
          dragActive
            ? "border-[#CC0000] bg-[#FCE8E8]"
            : "border-gray-300 bg-[#F9F9F9] hover:border-gray-400 hover:bg-gray-50",
        )}
      >
        <span
          className={cn(
            "flex size-12 items-center justify-center rounded-full",
            dragActive ? "bg-[#CC0000] text-white" : "bg-white text-gray-500 shadow-sm",
          )}
        >
          <UploadCloud className="size-6" aria-hidden="true" />
        </span>
        <p className="text-sm font-bold text-gray-900">
          {dragActive ? "Отпустите — загрузим!" : "Перетащите фото сюда"}
        </p>
        <p className="text-xs text-gray-500">PNG, JPEG, WebP, AVIF или GIF · до 8 МБ каждое</p>
        <Button
          type="button"
          variant="outline"
          onClick={(event) => {
            event.stopPropagation();
            openFileDialog();
          }}
          className="mt-1 rounded-full border-gray-300"
        >
          <ImagePlus className="size-4" aria-hidden="true" />
          Выбрать файлы
        </Button>
        <input
          ref={inputRef}
          id="image-manager-file-input"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
          multiple
          hidden
          onChange={(event) => {
            if (event.target.files?.length) uploadFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      {/* Счётчик и подсказки */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
        <span aria-live="polite">
          {images.length} из {MAX_IMAGES} фото
          {uploadingCount > 0 && ` · загружается ${uploadingCount}`}
          {mainIndex >= 0 && ` · главная — №${mainIndex + 1}`}
        </span>
        <span className="text-gray-400">
          Перетащите плитку, чтобы изменить порядок · ★ — главная фотография на карточке
        </span>
      </div>

      {/* Сетка фотографий с сортировкой */}
      {images.length > 0 && (
        <div className="mt-3">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={images.map((image) => image.key)} strategy={rectSortingStrategy}>
              <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {images.map((image, index) => (
                  <SortableTile
                    key={image.key}
                    image={image}
                    index={index}
                    onMakeMain={makeMain}
                    onRemove={removeImage}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* Библиотека магазина */}
      <Collapsible open={libraryOpen} onOpenChange={setLibraryOpen} className="mt-4">
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
          Добавить из библиотеки магазина
          <span className="ml-auto text-xs font-normal text-gray-400">{library.length} фото</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {library.length === 0 ? (
            <p className="px-2 pb-2 pt-1 text-xs text-gray-400">
              Библиотека пуста — загрузите фото с компьютера, и они появятся здесь
            </p>
          ) : (
            <div className="thin-scrollbar mt-1 grid max-h-64 grid-cols-3 gap-2 overflow-y-auto pb-1 pr-1 sm:grid-cols-6">
              {library.map((url) => {
                const added = images.some((image) => image.url === url);
                return (
                  <button
                    key={url}
                    type="button"
                    disabled={added}
                    onClick={() => addFromLibrary(url)}
                    aria-label={added ? `Уже добавлено: ${url}` : `Добавить фото: ${url}`}
                    className={cn(
                      "relative aspect-square overflow-hidden rounded-lg bg-[#F7F7F7] ring-1 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC0000]",
                      added
                        ? "cursor-default opacity-50 ring-gray-200"
                        : "cursor-pointer ring-gray-200 hover:ring-gray-400 active:scale-95",
                    )}
                  >
                    {/* blob-превью и локальные пути без оптимизации Next */}
                    <img src={url} alt="" className="size-full object-cover" loading="lazy" />
                    {added && (
                      <span className="absolute inset-0 flex items-center justify-center bg-white/60">
                        <Check className="size-5 text-emerald-600" aria-hidden="true" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

/** Плитка фотографии: превью, «звёздочка» главной, удаление, drag-захват */
function SortableTile({
  image,
  index,
  onMakeMain,
  onRemove,
}: {
  image: ManagedImage;
  index: number;
  onMakeMain: (key: string) => void;
  onRemove: (key: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: image.key,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "relative aspect-square overflow-hidden rounded-xl bg-[#F7F7F7] ring-1 transition-shadow",
        image.isMain ? "ring-2 ring-[#CC0000]" : "ring-gray-200",
        isDragging ? "z-10 shadow-lg ring-2 ring-[#CC0000]" : "hover:ring-gray-400",
      )}
      {...attributes}
      {...listeners}
      aria-label={`Фото №${index + 1}. Перетащите, чтобы изменить порядок${image.isMain ? ", главная фотография" : ""}`}
    >
      {/* blob-превью во время загрузки без оптимизации Next */}
      <img
        src={image.preview}
        alt=""
        draggable={false}
        className={cn("pointer-events-none size-full object-cover", image.url === null && "opacity-60")}
      />

      {/* Оверлей загрузки */}
      {image.url === null && (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-white/60 text-[11px] font-semibold text-gray-600">
          <Loader2 className="size-5 animate-spin text-[#CC0000]" aria-hidden="true" />
          Загрузка…
        </span>
      )}

      {/* Ручка перетаскивания */}
      <span
        className="absolute left-1.5 top-1.5 flex size-7 cursor-grab items-center justify-center rounded-full bg-white/95 text-gray-500 shadow-sm active:cursor-grabbing"
        aria-hidden="true"
      >
        <GripVertical className="size-4" />
      </span>

      {/* Удаление */}
      <button
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => onRemove(image.key)}
        aria-label={`Удалить фото №${index + 1}`}
        className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-white/95 text-gray-500 shadow-sm transition-colors hover:bg-white hover:text-[#CC0000] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC0000]/40"
      >
        <Trash2 className="size-3.5" aria-hidden="true" />
      </button>

      {/* Главная фотография: активная — бейдж, иначе кнопка-звёздочка */}
      {image.isMain ? (
        <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-[#CC0000] px-2 py-1 text-[11px] font-bold leading-none text-white shadow-sm">
          <Star className="size-3 fill-white" aria-hidden="true" />
          Главная
        </span>
      ) : (
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onMakeMain(image.key)}
          aria-label={`Сделать фото №${index + 1} главным`}
          className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[11px] font-semibold leading-none text-gray-600 shadow-sm transition-colors hover:bg-white hover:text-[#CC0000] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC0000]/40"
        >
          <Star className="size-3" aria-hidden="true" />
          Главная?
        </button>
      )}
    </li>
  );
}
