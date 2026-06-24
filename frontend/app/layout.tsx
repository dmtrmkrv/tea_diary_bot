import { Suspense } from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import AddTeaSheetController from "@/components/AddTeaSheetController";
import { Toaster } from "@/components/ui/sonner";
import TzSync from "@/components/TzSync";
import YandexMetrika from "@/components/YandexMetrika";
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
          <div className="pb-[88px]">
            {children}
          </div>
          <Suspense fallback={null}>
            <BottomNav />
          </Suspense>
          <AddTeaSheetController />
          <Toaster position="top-center" />
          <TzSync />
          <YandexMetrika />
        </Providers>
      </body>
    </html>
  );
}
