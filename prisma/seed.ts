// Seed: 5 категорий + 16 кукол для «КуклаМаркет»
// Запуск: bun prisma/seed.ts (из корня проекта)
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

type SeedProduct = {
  slug: string;
  name: string;
  description: string;
  price: number;
  oldPrice?: number;
  rating: number;
  reviewsCount: number;
  badge?: string;
  brand: string;
  ageMin: number;
  stock: number;
  featured?: boolean;
};

const categories: { slug: string; name: string; sort: number; products: SeedProduct[] }[] = [
  {
    slug: "fashion",
    name: "Модные куклы",
    sort: 1,
    products: [
      {
        slug: "fashion-victoria",
        name: "Кукла «Виктория» с гардеробом и 6 нарядами",
        description:
          "Виктория обожает моду! В наборе — кукла с длинными волосами, мини-гардероб и 6 нарядов: от вечернего платья до спортивного костюма. Расчёска и аксессуары в комплекте.",
        price: 3499,
        oldPrice: 4299,
        rating: 4.8,
        reviewsCount: 214,
        badge: "hit",
        brand: "Belle Poupée",
        ageMin: 3,
        stock: 18,
        featured: true,
      },
      {
        slug: "fashion-runway",
        name: "Набор «Подиум»: кукла и 3 наряда",
        description:
          "Создай настоящий показ мод! Кукла в гламурном наряде, три сменных образа и зеркальная сцена-подиум в комплекте.",
        price: 2799,
        rating: 4.6,
        reviewsCount: 128,
        badge: "new",
        brand: "Belle Poupée",
        ageMin: 3,
        stock: 25,
      },
      {
        slug: "fashion-summer",
        name: "Кукла «Летний бриз» с чемоданчиком",
        description:
          "Идеальный набор для летних приключений: кукла в ярком сарафане, чемоданчик, шляпа, солнечные очки и мини-аксессуары.",
        price: 1999,
        oldPrice: 2499,
        rating: 4.5,
        reviewsCount: 87,
        badge: "sale",
        brand: "Sunny Toys",
        ageMin: 3,
        stock: 30,
      },
    ],
  },
  {
    slug: "baby",
    name: "Куклы-младенцы",
    sort: 2,
    products: [
      {
        slug: "baby-mia",
        name: "Кукла-младенец «Мия» с пелёнкой и бутылочкой",
        description:
          "Мия — нежный пупс с реалистичной мимикой. В комплекте мягкая пелёнка, бутылочка и соска. Тело куклы можно купать.",
        price: 1799,
        oldPrice: 2199,
        rating: 4.9,
        reviewsCount: 342,
        badge: "hit",
        brand: "Baby Love",
        ageMin: 2,
        stock: 22,
        featured: true,
      },
      {
        slug: "baby-twins",
        name: "Двойняшки «Тома и Тим» — набор из 2 кукол",
        description:
          "Двойняшки Тома и Тим такие разные, но неразлучные! Две куклы-младенца в комбинезонах с голубым и розовым узором.",
        price: 2999,
        rating: 4.7,
        reviewsCount: 156,
        brand: "Baby Love",
        ageMin: 2,
        stock: 15,
      },
      {
        slug: "baby-mila-stroller",
        name: "Кукла «Мила» с коляской",
        description:
          "Кукла Мила с удобной коляской: капюшон от солнца, корзинка для игрушек и ремни безопасности. Коляска складывается одним движением.",
        price: 2499,
        oldPrice: 3199,
        rating: 4.6,
        reviewsCount: 98,
        badge: "sale",
        brand: "Baby Love",
        ageMin: 2,
        stock: 12,
      },
    ],
  },
  {
    slug: "collectible",
    name: "Коллекционные",
    sort: 3,
    products: [
      {
        slug: "collectible-anastasia",
        name: "Фарфоровая кукла «Анастасия» в бальном платье",
        description:
          "Роскошная фарфоровая кукла в бальном платье с кружевом. Волосы уложены в высокую причёску, подставка в комплекте. Прекрасный подарок коллекционеру.",
        price: 8999,
        rating: 4.9,
        reviewsCount: 76,
        badge: "hit",
        brand: "Petite Collection",
        ageMin: 14,
        stock: 7,
        featured: true,
      },
      {
        slug: "collectible-vintage",
        name: "Винтажная кукла «Ностальгия» в стиле 60-х",
        description:
          "Кукла в стиле 60-х: горошек, перчатки и ретро-причёска. Очаровательная винтажная классика для ценителей.",
        price: 6499,
        oldPrice: 7999,
        rating: 4.8,
        reviewsCount: 41,
        badge: "deal",
        brand: "Petite Collection",
        ageMin: 14,
        stock: 9,
      },
      {
        slug: "collectible-theatre",
        name: "Коллекционная кукла «Театральный сезон»",
        description:
          "Бархатное бордовое платье, золотой веер и маска — кукла «Театральный сезон» станет жемчужиной коллекции.",
        price: 7499,
        rating: 4.7,
        reviewsCount: 29,
        badge: "new",
        brand: "Petite Collection",
        ageMin: 14,
        stock: 6,
      },
    ],
  },
  {
    slug: "interactive",
    name: "Интерактивные",
    sort: 4,
    products: [
      {
        slug: "interactive-sonya",
        name: "Интерактивная кукла «Соня» — 30 фраз и песенок",
        description:
          "Соня говорит 30 фраз, поёт песенки и рассказывает сказки! Глаза открываются и закрываются. Работает от батареек (в комплекте).",
        price: 4299,
        oldPrice: 5299,
        rating: 4.7,
        reviewsCount: 265,
        badge: "hit",
        brand: "Talky Toys",
        ageMin: 3,
        stock: 20,
        featured: true,
      },
      {
        slug: "interactive-vet",
        name: "Кукла-ветеринар «Вера» с питомцем",
        description:
          "Ветеринар Вера лечит зверей! Белый халат, плюшевый щенок и чемоданчик доктора со стетоскопом и игрушечным шприцем.",
        price: 3699,
        rating: 4.8,
        reviewsCount: 183,
        brand: "Career Kids",
        ageMin: 3,
        stock: 16,
      },
      {
        slug: "interactive-teacher",
        name: "Кукла-учительница «Ольга» со школьным набором",
        description:
          "Учительница Ольга проводит первый урок: школьная доска, крошечные тетради, указка и глобус. Кукла с подвижными руками.",
        price: 3299,
        oldPrice: 3899,
        rating: 4.5,
        reviewsCount: 64,
        badge: "sale",
        brand: "Career Kids",
        ageMin: 3,
        stock: 14,
      },
    ],
  },
  {
    slug: "playsets",
    name: "Домики и аксессуары",
    sort: 5,
    products: [
      {
        slug: "playsets-dollhouse",
        name: "Кукольный домик «Уют» с мебелью, 3 этажа",
        description:
          "Трёхэтажный кукольный домик с мебелью: спальня, кухня, гостиная и балкон. Сборка за 20 минут по инструкции. Высота — 90 см.",
        price: 9999,
        oldPrice: 12499,
        rating: 4.9,
        reviewsCount: 412,
        badge: "deal",
        brand: "Dream House",
        ageMin: 3,
        stock: 11,
        featured: true,
      },
      {
        slug: "playsets-furniture",
        name: "Мебельный набор для кукольного дома, 14 предметов",
        description:
          "Набор из 14 предметов мебели для кукольного дома: кровать с балдахином, обеденный стол, стулья, диван и торшер.",
        price: 2299,
        rating: 4.4,
        reviewsCount: 73,
        brand: "Dream House",
        ageMin: 3,
        stock: 19,
      },
      {
        slug: "playsets-clothes-set",
        name: "Гардероб для кукол: 10 нарядов и вешалки",
        description:
          "Гардероб для кукол: 10 нарядов на все случаи — от пижамы до бального платья, вешалки и коробка для хранения.",
        price: 1599,
        oldPrice: 1999,
        rating: 4.6,
        reviewsCount: 231,
        badge: "hit",
        brand: "Belle Poupée",
        ageMin: 3,
        stock: 28,
      },
      {
        slug: "playsets-teaset",
        name: "Чайный сервиз для кукол, 15 предметов",
        description:
          "Фарфоровый чайный сервиз на 4 персоны: чайник, чашки, блюдца и сахарница с цветочным узором. 15 предметов.",
        price: 1299,
        rating: 4.5,
        reviewsCount: 158,
        brand: "Dream House",
        ageMin: 6,
        stock: 24,
      },
    ],
  },
];

async function main() {
  // Очистка в FK-безопасном порядке
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.cartItem.deleteMany();
  await db.product.deleteMany();
  await db.category.deleteMany();

  let total = 0;
  for (const cat of categories) {
    const created = await db.category.create({
      data: { slug: cat.slug, name: cat.name, sort: cat.sort },
    });
    for (const p of cat.products) {
      await db.product.create({
        data: {
          slug: p.slug,
          name: p.name,
          description: p.description,
          price: p.price,
          oldPrice: p.oldPrice ?? null,
          image: `/images/products/${p.slug}.png`,
          rating: p.rating,
          reviewsCount: p.reviewsCount,
          badge: p.badge ?? null,
          brand: p.brand,
          ageMin: p.ageMin,
          stock: p.stock,
          featured: p.featured ?? false,
          categoryId: created.id,
        },
      });
      total++;
    }
  }
  console.log(`Seeded ${categories.length} categories, ${total} products`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
