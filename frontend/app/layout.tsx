import { Suspense } from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import AddTeaSheetController from "@/components/AddTeaSheetController";
import { Toaster } from "@/components/ui/sonner";
import TzSync from "@/components/TzSync";
import YandexMetrika from "@/components/YandexMetrika";
import CookieBanner from "@/components/CookieBanner";
import { Providers } from "./providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "Чайный дневник",
  description: "Записи чайных дегустаций",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col font-[family-name:var(--font-inter)]">
        <Providers>
          <div className="app-content pb-[88px]">
            {children}
          </div>
          {/* Обёртка нужна, чтобы CSS мог скрыть навигацию на лендинге (см. globals.css) */}
          <div className="bottom-nav-slot">
            <Suspense fallback={null}>
              <BottomNav />
            </Suspense>
          </div>
          <AddTeaSheetController />
          <Toaster position="top-center" />
          <TzSync />
          <YandexMetrika />
          <CookieBanner />
        </Providers>
      </body>
    </html>
  );
}
