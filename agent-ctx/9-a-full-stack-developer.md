# Task 9-a — full-stack-developer (BACKEND: API + Prisma)

Проект: «КуклаМаркет» (/home/z/my-project). Полный контекст — в /home/z/my-project/worklog.md
(канонические контракты) и в этой папке /agent-ctx (записи других агентов).

## Что сделано (бэкенд CMS)

1. **prisma/schema.prisma** — добавлена модель `SiteSettings` (singleton id=1: 4 фичи-переключателя
   + 4 поля баннера, `updatedAt @updatedAt`). `bun run db:push` выполнен (аддитивно, клиент
   перегенерирован).
2. **GET/PUT /api/settings** (`src/app/api/settings/route.ts`):
   - GET гарантирует строку id=1 (создаёт с дефолтами), возвращает
     `{ features: { aiAssistant, voiceSearch, account, cart }, hero: { kicker, title, subtitle, ctaText } }`.
   - PUT — частичные `features`/`hero`, валидация: boolean-значения фич; kicker ≤ 60 (можно пусто);
     title ≤ 140 и непустой после trim («Заголовок баннера не может быть пустым»); subtitle ≤ 220
     (можно пусто); ctaText ≤ 40 и непустой. Upsert id=1, ответ = как GET.
3. **GET /api/images** (`src/app/api/images/route.ts`) — отсортированный JSON-массив
   `/images/products/<файл>` из public/images/products (png/jpg/jpeg/webp/avif, только файлы).
4. **POST /api/products** (добавлен в `src/app/api/products/route.ts`, GET не тронут) — полная
   валидация всех полей (см. контракт ниже), slug = транслитерация RU→EN из name с суффиксами
   -2…-99 при занятости, проверка категории и существования файла фото, ответ 201 с `category`.
5. **PUT/DELETE /api/products/[id]** (добавлены в `src/app/api/products/[id]/route.ts`, GET не
   тронут): PUT — частичное обновление (slug не меняется, oldPrice сверяется с новой/текущей
   ценой), DELETE — 409 при товаре в заказах (внешний ключ OrderItem), CartItem каскадом удаляется.
6. Общий модуль валидации: `src/app/api/products/_shared.ts` (parseProductInput, slugifyName,
   imageFileExists) — не роут, префикс `_`.

## ВАЖНО для следующих агентов

- **Prisma + живой dev-сервер**: сервер был запущен ДО перегенерации клиента, поэтому глобальный
  синглтон `db` (src/lib/db.ts) не знает модель SiteSettings (`db.siteSettings === undefined`).
  В `/api/settings` сделан гибрид: `"siteSettings" in db` → типизированный делегат, иначе честный
  SQL через `db.$queryRaw`/`$executeRaw` (формат DateTime — epoch-мс, как у Prisma; проверено).
  **После любого перезапуска dev-сервера автоматически работает типизированный путь.** Ничего
  делать не нужно — оба пути дают идентичный API.
- PUT/POST товаров работают на старом клиенте без ограничений (модель Product не менялась).
- В БД есть 2 посторонних CartItem (productId 1 и 4, старые cartId из пользовательских сессий
  превью) — не трогал, на каталог/настройки не влияют.

## Контракты (кратко)

- `GET /api/settings` → 200 `{ features: {...4 bool}, hero: {...4 string} }`
- `PUT /api/settings` → 200 (та же структура) | 400 `{ error }` | 500
- `GET /api/images` → 200 `["/images/products/<файл>", …]` (16 шт., сортировка)
- `POST /api/products` → 201 `Product + category` | 400 `{ error }` (валидация) | 500
  - обязательные: name (1..200), description (1..2000), price (целое 1..10 000 000),
    categoryId (существует), image (матчит ^/images/products/[A-Za-z0-9._-]+$ и файл есть)
  - опциональные: brand (дефолт «КуклаМаркет», 1..80), oldPrice (целое > price, иначе
    «Старая цена должна быть больше текущей»), badge (hit|new|sale|deal), stock (0..100 000,
    дефолт 25), ageMin (0..18, дефолт 3), rating (0..5, округление до 1 знака, дефолт 4.5),
    reviewsCount (0..1 000 000, дефолт 0), featured (bool, дефолт false)
  - slug из name: транслит → lowercase → не-буквоцифры «-» → схлопывание/обрезка; пусто →
    «tovar»; занят → -2…-99, иначе 500
- `PUT /api/products/[id]` → 200 `Product + category` | 404 | 400 (те же правила, только
  переданные поля; slug не меняется; oldPrice сравнивается с новой либо текущей ценой)
- `DELETE /api/products/[id]` → 200 `{ ok: true }` | 404 | 409 `{ error: "Нельзя удалить товар,
  который уже есть в заказах" }`

## Тесты (curl, http://localhost:3000)

Все по спецификации: GET/PUT настроек (вкл/выкл cart, восстановление, пустой title → 400,
нелогические значения → 400, титул >140 → 400, пустой kicker допускается), /api/images (16),
создание «Тест админ кукла» → 201 id=17 slug=test-admin-kukla, дубль имени → slug-2,
PUT price 1500 → 200, POST price -5 → 400, oldPrice ≤ price → 400, неверный badge/фото/
категория → 400, DELETE 17/18/19 → `{ok:true}` + GET → 404, DELETE товара из заказа (id=3)
→ 409, каскад CartItem подтверждён. Чистка: ровно 16 исходных товаров, настройки = дефолты
(побайтово сверены). `bun run lint` — 0 ошибок; tsc по src/app/api — 0 ошибок; dev.log чист
(4xx/5xx в логе — только намеренные тесты).

## Примечание про init-fullstack

Скрипт init-fullstack пропущен осознанно: проект уже инициализирован, а при наличии
.zscripts/dev.sh скрипт перезапустил бы dev-сервер (перезапуск запрещён заданием). Сервер
оставлен работать как есть (порт 3000, здоровье проверено).
