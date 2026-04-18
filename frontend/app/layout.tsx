import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";

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
    <html lang="ru" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#e7e5e4] font-[family-name:var(--font-inter)]">
        <div className="pb-[88px]">
          {children}
        </div>
        <BottomNav />
      </body>
    </html>
  );
}
