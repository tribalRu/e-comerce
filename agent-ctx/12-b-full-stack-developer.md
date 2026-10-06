# Task 12-b — full-stack-developer — Бэкенд менеджера фотографий товара (CMS)

Контракты Task 12 (CANONICAL, worklog.md) соблюдены полностью. Frontend-агент
может опираться на: POST /api/upload → 201 { url }, GET /api/images (products +
uploads), поле `images` в POST/PUT /api/products[/id], GET [id] с images и
фолбэком, GET-список без images.

## Созданные/изменённые файлы
- `src/app/api/upload/route.ts` — НОВЫЙ: POST multipart "file"; MIME png/jpeg/
  webp/avif/gif → ext; 0 → «Пустой файл», >8МБ → «Файл больше 8 МБ», прочий тип →
  «Поддерживаются форматы PNG, JPEG, WebP, AVIF и GIF»; имя uuid+ext →
  public/images/uploads (mkdir recursive); sharp для png/jpeg/webp (ресайз до
  1800 по длинной стороне, fit inside + withoutEnlargement, q85 для jpeg/webp);
  gif/avif как есть; ошибки обработки → 400 «Не удалось обработать изображение»;
  201 { url: "/images/uploads/<uuid>.<ext>" }
- `src/app/api/images/route.ts` — объединение products + uploads (каждый в
  try/catch, отсутствующий пропускается), расширения png/jpe?g/webp/avif/gif,
  отсортированный массив строк
- `src/app/api/products/_shared.ts` — IMAGE_PATTERN
  `^\/images\/(products|uploads)\/[A-Za-z0-9._-]+$`; imageFileExists по префиксу
  url; ProductInputData.images?: { url: string; isMain: boolean }[];
  валидация images: 1..12, объекты, url по паттерну, без дублей, isMain boolean,
  ≤1 главной (0 → первая); при валидном images поле image игнорируется
- `src/app/api/products/route.ts` — POST: images → проверка файлов + главное
  фото из набора; иначе старый контракт; create images:{create: rows}
  (sortOrder = индекс); ответ 201 include category + images orderBy sortOrder;
  GET не менялся
- `src/app/api/products/[id]/route.ts` — GET include images + фолбэк
  [{url: product.image, isMain: true}] для старых товаров; PUT: imageRows из
  images либо одиночного image; пустое тело → existing (+фолбэк); скаляры —
  обычный update; полная замена — $transaction(update + deleteMany +
  createMany) + свежий fetch; DELETE не менялся (каскад работает)

## Тесты (curl, живой :3000, hot-reload, сервер не перезапускался)
- upload: PNG→201+200 статики; 2500x1200→1800x864; WebP/GIF как ожидалось;
  txt/9МБ/пустое/битый → все 400 с корректными сообщениями
- /api/images: 19 (16+3), сортировка; без каталога uploads → 16
- POST: images 3 записи → 201 (порядок, isMain, product.image из главной, поле
  image тела игнорируется); 2 isMain/дубль/13/[]/не-массив/нет файла/не-boolean
  isMain → 400; старый контракт → 201 одна запись
- GET [id]: сортировка; фолбэк старых; 404; список без images
- PUT: порядок+главная; image→одна запись; {} без изменений; price не трогает
  фото; ошибки 400; DELETE каскад
- lint 0; tsc 0 в src/app/api/**; dev.log без 500

## Чистка
Товары 22/23/24 удалены; товар 2 восстановлен (image fashion-runway.png, без
ProductImage); uploads пуст (только .gitkeep); итог: 16 товаров,
productImage.count = 0.
