import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "КуклаМаркет — интернет-магазин кукол",
  description:
    "Модные, коллекционные и интерактивные куклы, домики и аксессуары. Бесплатная доставка от 3 000 ₽, возврат 90 дней.",
  keywords: ["куклы", "интернет-магазин кукол", "купить куклу", "куклы-младенцы", "коллекционные куклы"],
  icons: {
    icon: "/bullseye.svg",
  },
  openGraph: {
    title: "КуклаМаркет — интернет-магазин кукол",
    description:
      "Модные, коллекционные и интерактивные куклы, домики и аксессуары. Скидки до 40%.",
    siteName: "КуклаМаркет",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-white text-gray-900 antialiased`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
