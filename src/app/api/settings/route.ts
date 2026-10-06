// GET/PUT /api/settings — настройки витрины (CMS): переключатели фич и баннер.
// Контракт: { features: { aiAssistant, voiceSearch, account, cart },
//             hero: { image, kicker, title, subtitle, ctaText } }.
// hero.image — постер баннера: «/images/hero-dolls.png» (стандартный) или
// «/images/hero/<файл>» (загруженный через POST /api/upload/hero); файл должен
// существовать в public/images (иначе 400).
// GET гарантирует наличие singleton-строки SiteSettings id=1 (создаёт с дефолтами).
// PUT: { features?: { …частично… }, hero?: { …частично… } } — оба ключа опциональны,
// поля внутри опциональны; upsert строки id=1; возвращает полную структуру, как GET.
//
// Слой доступа: обычно используется типизированный делегат db.siteSettings. Исключение —
// долго живущий dev-сервер, запущенный ДО перегенерации Prisma Client (`bun run db:push`
// с новой моделью): глобальный синглтон из src/lib/db.ts держит старый экземпляр клиента
// без SiteSettings, поэтому пока сервер не перезапущен, настройки читаются/пишутся сырым
// SQL через $queryRaw/$executeRaw (таблица уже создана db:push). После перезапуска
// dev-сервера делегат появляется и используется автоматически.

import { NextResponse, type NextRequest } from "next/server";
import { stat } from "fs/promises";
import path from "path";
import type { SiteSettings } from "@prisma/client";
import { db } from "@/lib/db";

// Маппинг ключей features из API на поля модели
const FEATURE_FIELDS = {
  aiAssistant: "aiAssistantEnabled",
  voiceSearch: "voiceSearchEnabled",
  account: "accountEnabled",
  cart: "cartEnabled",
} as const;

type FeatureKey = keyof typeof FEATURE_FIELDS;

// Поля модели, которые разрешено менять через PUT
type SettingsFields = {
  aiAssistantEnabled?: boolean;
  voiceSearchEnabled?: boolean;
  accountEnabled?: boolean;
  cartEnabled?: boolean;
  heroImage?: string;
  heroKicker?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  heroCtaText?: string;
};

// Дефолты (совпадают с дефолтами полей в prisma/schema.prisma)
const SETTINGS_DEFAULTS = {
  aiAssistantEnabled: true,
  voiceSearchEnabled: true,
  accountEnabled: true,
  cartEnabled: true,
  heroImage: "/images/hero-dolls.png",
  heroKicker: "Неделя кукол",
  heroTitle: "Мир кукол со скидками до 40%",
  heroSubtitle:
    "Модные наряды, уютные домики и фарфоровые коллекционные куклы — всё для игры и восхищения.",
  heroCtaText: "Смотреть каталог",
} satisfies SettingsFields;

/** Стандартный постер баннера */
const DEFAULT_HERO_IMAGE = "/images/hero-dolls.png";

/** Постер из /images/hero/<файл> (имя не начинается с точки — без «..») */
const HERO_IMAGE_PATTERN = /^\/images\/hero\/[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** Проверка существования файла постера в public/images */
async function heroImageExists(image: string): Promise<boolean> {
  try {
    const relative =
      image === DEFAULT_HERO_IMAGE
        ? path.join("images", "hero-dolls.png")
        : path.join("images", "hero", image.slice("/images/hero/".length));
    const info = await stat(path.join(process.cwd(), "public", relative));
    return info.isFile();
  } catch {
    return false;
  }
}

// Полный ответ API из строки настроек
function toSettingsResponse(settings: SiteSettings) {
  return {
    features: {
      aiAssistant: settings.aiAssistantEnabled,
      voiceSearch: settings.voiceSearchEnabled,
      account: settings.accountEnabled,
      cart: settings.cartEnabled,
    },
    hero: {
      image: settings.heroImage,
      kicker: settings.heroKicker,
      title: settings.heroTitle,
      subtitle: settings.heroSubtitle,
      ctaText: settings.heroCtaText,
    },
  };
}

// Сырая строка SiteSettings (SQLite хранит boolean как 0/1)
type SettingsRow = {
  id: number;
  aiAssistantEnabled: number;
  voiceSearchEnabled: number;
  accountEnabled: number;
  cartEnabled: number;
  heroImage: string;
  heroKicker: string;
  heroTitle: string;
  heroSubtitle: string;
  heroCtaText: string;
  updatedAt: Date;
};

function rowToSettings(row: SettingsRow): SiteSettings {
  return {
    id: row.id,
    aiAssistantEnabled: Boolean(row.aiAssistantEnabled),
    voiceSearchEnabled: Boolean(row.voiceSearchEnabled),
    accountEnabled: Boolean(row.accountEnabled),
    cartEnabled: Boolean(row.cartEnabled),
    heroImage: row.heroImage,
    heroKicker: row.heroKicker,
    heroTitle: row.heroTitle,
    heroSubtitle: row.heroSubtitle,
    heroCtaText: row.heroCtaText,
    updatedAt: row.updatedAt,
  };
}

// Есть ли у текущего экземпляра клиента типизированный делегат SiteSettings
function hasSettingsModel(): boolean {
  return "siteSettings" in db;
}

async function readSettings(): Promise<SiteSettings | null> {
  if (hasSettingsModel()) {
    return db.siteSettings.findUnique({ where: { id: 1 } });
  }
  const rows = await db.$queryRaw<SettingsRow[]>`
    SELECT id, aiAssistantEnabled, voiceSearchEnabled, accountEnabled, cartEnabled,
           heroImage, heroKicker, heroTitle, heroSubtitle, heroCtaText, updatedAt
    FROM SiteSettings WHERE id = 1`;
  return rows.length > 0 ? rowToSettings(rows[0]) : null;
}

async function createSettings(fields: SettingsFields): Promise<SiteSettings> {
  if (hasSettingsModel()) {
    return db.siteSettings.create({ data: { id: 1, ...fields } });
  }
  const values = { ...SETTINGS_DEFAULTS, ...fields };
  const updatedAt = new Date();
  await db.$executeRaw`
    INSERT INTO SiteSettings
      (id, aiAssistantEnabled, voiceSearchEnabled, accountEnabled, cartEnabled,
       heroImage, heroKicker, heroTitle, heroSubtitle, heroCtaText, updatedAt)
    VALUES
      (1, ${values.aiAssistantEnabled ? 1 : 0}, ${values.voiceSearchEnabled ? 1 : 0},
       ${values.accountEnabled ? 1 : 0}, ${values.cartEnabled ? 1 : 0},
       ${values.heroImage}, ${values.heroKicker}, ${values.heroTitle}, ${values.heroSubtitle},
       ${values.heroCtaText}, ${updatedAt})`;
  return { id: 1, ...values, updatedAt };
}

async function updateSettings(fields: SettingsFields): Promise<SiteSettings> {
  if (hasSettingsModel()) {
    return db.siteSettings.update({ where: { id: 1 }, data: fields });
  }
  const assignments: string[] = [];
  const params: unknown[] = [];
  const push = (column: string, value: unknown) => {
    assignments.push(`${column} = ?`);
    params.push(value);
  };
  if (fields.aiAssistantEnabled !== undefined) {
    push("aiAssistantEnabled", fields.aiAssistantEnabled ? 1 : 0);
  }
  if (fields.voiceSearchEnabled !== undefined) {
    push("voiceSearchEnabled", fields.voiceSearchEnabled ? 1 : 0);
  }
  if (fields.accountEnabled !== undefined) {
    push("accountEnabled", fields.accountEnabled ? 1 : 0);
  }
  if (fields.cartEnabled !== undefined) {
    push("cartEnabled", fields.cartEnabled ? 1 : 0);
  }
  if (fields.heroImage !== undefined) {
    push("heroImage", fields.heroImage);
  }
  if (fields.heroKicker !== undefined) {
    push("heroKicker", fields.heroKicker);
  }
  if (fields.heroTitle !== undefined) {
    push("heroTitle", fields.heroTitle);
  }
  if (fields.heroSubtitle !== undefined) {
    push("heroSubtitle", fields.heroSubtitle);
  }
  if (fields.heroCtaText !== undefined) {
    push("heroCtaText", fields.heroCtaText);
  }
  push("updatedAt", new Date());
  await db.$executeRawUnsafe(
    `UPDATE SiteSettings SET ${assignments.join(", ")} WHERE id = 1`,
    ...params
  );
  const settings = await readSettings();
  if (!settings) {
    throw new Error("Строка SiteSettings не найдена после обновления");
  }
  return settings;
}

// Гарантирует наличие singleton-строки id=1 (с дефолтами)
async function getOrCreateSettings(): Promise<SiteSettings> {
  const existing = await readSettings();
  if (existing) {
    return existing;
  }
  try {
    return await createSettings({});
  } catch {
    // Строку мог параллельно создать другой запрос — читаем её
    const settings = await readSettings();
    if (!settings) {
      throw new Error("Не удалось создать строку SiteSettings");
    }
    return settings;
  }
}

export async function GET() {
  try {
    const settings = await getOrCreateSettings();
    return NextResponse.json(toSettingsResponse(settings));
  } catch (error) {
    console.error("GET /api/settings:", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Некорректное тело запроса" }, { status: 400 });
    }
    const raw = body as Record<string, unknown>;

    const fields: SettingsFields = {};

    // features: объект; значения только boolean (иначе 400); известные ключи применяются
    if (raw.features !== undefined) {
      if (
        typeof raw.features !== "object" ||
        raw.features === null ||
        Array.isArray(raw.features)
      ) {
        return NextResponse.json(
          { error: "Поле features должно быть объектом" },
          { status: 400 }
        );
      }
      const features = raw.features as Record<string, unknown>;
      for (const [key, value] of Object.entries(features)) {
        if (typeof value !== "boolean") {
          return NextResponse.json(
            { error: "Значения features должны быть true или false" },
            { status: 400 }
          );
        }
        const field = FEATURE_FIELDS[key as FeatureKey];
        if (field) {
          fields[field] = value;
        }
      }
    }

    // hero: kicker ≤ 60 (может быть пустым), title ≤ 140 и непустой после trim,
    // subtitle ≤ 220 (может быть пустым), ctaText ≤ 40 и непустой после trim
    if (raw.hero !== undefined) {
      if (typeof raw.hero !== "object" || raw.hero === null || Array.isArray(raw.hero)) {
        return NextResponse.json(
          { error: "Поле hero должно быть объектом" },
          { status: 400 }
        );
      }
      const hero = raw.hero as Record<string, unknown>;

      // image: «/images/hero-dolls.png» или «/images/hero/<файл>»; файл должен
      // существовать в public/images (защита от «постера-призрака»)
      if (hero.image !== undefined) {
        if (typeof hero.image !== "string") {
          return NextResponse.json(
            { error: "Постер баннера должен быть строкой" },
            { status: 400 }
          );
        }
        const poster = hero.image.trim();
        if (poster.length > 200) {
          return NextResponse.json(
            { error: "Адрес постера не длиннее 200 символов" },
            { status: 400 }
          );
        }
        if (poster !== DEFAULT_HERO_IMAGE && !HERO_IMAGE_PATTERN.test(poster)) {
          return NextResponse.json(
            { error: "Постер должен быть «/images/hero-dolls.png» или «/images/hero/<файл>»" },
            { status: 400 }
          );
        }
        if (!(await heroImageExists(poster))) {
          return NextResponse.json({ error: "Файл постера не найден" }, { status: 400 });
        }
        fields.heroImage = poster;
      }

      if (hero.kicker !== undefined) {
        if (typeof hero.kicker !== "string") {
          return NextResponse.json(
            { error: "Надзаголовок баннера должен быть строкой" },
            { status: 400 }
          );
        }
        if (hero.kicker.length > 60) {
          return NextResponse.json(
            { error: "Надзаголовок баннера не длиннее 60 символов" },
            { status: 400 }
          );
        }
        fields.heroKicker = hero.kicker;
      }

      if (hero.title !== undefined) {
        if (typeof hero.title !== "string") {
          return NextResponse.json(
            { error: "Заголовок баннера должен быть строкой" },
            { status: 400 }
          );
        }
        if (hero.title.trim().length === 0) {
          return NextResponse.json(
            { error: "Заголовок баннера не может быть пустым" },
            { status: 400 }
          );
        }
        if (hero.title.length > 140) {
          return NextResponse.json(
            { error: "Заголовок баннера не длиннее 140 символов" },
            { status: 400 }
          );
        }
        fields.heroTitle = hero.title;
      }

      if (hero.subtitle !== undefined) {
        if (typeof hero.subtitle !== "string") {
          return NextResponse.json(
            { error: "Подзаголовок баннера должен быть строкой" },
            { status: 400 }
          );
        }
        if (hero.subtitle.length > 220) {
          return NextResponse.json(
            { error: "Подзаголовок баннера не длиннее 220 символов" },
            { status: 400 }
          );
        }
        fields.heroSubtitle = hero.subtitle;
      }

      if (hero.ctaText !== undefined) {
        if (typeof hero.ctaText !== "string") {
          return NextResponse.json(
            { error: "Текст кнопки должен быть строкой" },
            { status: 400 }
          );
        }
        if (hero.ctaText.trim().length === 0) {
          return NextResponse.json(
            { error: "Текст кнопки не может быть пустой" },
            { status: 400 }
          );
        }
        if (hero.ctaText.length > 40) {
          return NextResponse.json(
            { error: "Текст кнопки не длиннее 40 символов" },
            { status: 400 }
          );
        }
        fields.heroCtaText = hero.ctaText;
      }
    }

    // Upsert singleton-строки id=1 (create — с дефолтами + переданные значения)
    const existing = await readSettings();
    const settings =
      existing === null
        ? await createSettings(fields)
        : Object.keys(fields).length > 0
          ? await updateSettings(fields)
          : existing;

    return NextResponse.json(toSettingsResponse(settings));
  } catch (error) {
    console.error("PUT /api/settings:", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
