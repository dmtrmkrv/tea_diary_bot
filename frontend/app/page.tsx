export const dynamic = 'force-dynamic';

import { getTastings } from '@/lib/api';
import CategoryBadge from '@/components/CategoryBadge';
import Image from 'next/image';
import Link from 'next/link';

interface Tasting {
  id: number;
  seq_no: number;
  name: string;
  category: string;
  year: number | null;
  region: string | null;
  rating: number;
  grams: number | null;
  temp_c: number | null;
  effects_csv: string | null;
  entry_mode: string;
  cover_url: string | null;
}

export default async function Home() {
  const tastings: Tasting[] = await getTastings();

  return (
    <main className="min-h-screen bg-[#e7e5e4]">
      <div className="max-w-2xl mx-auto px-4">
        {/* Заголовок — top: 46px по Figma */}
        <h1 className="font-[family-name:var(--font-geist-sans)] text-[32px] font-semibold leading-[32px] tracking-[-1px] text-black pt-[46px]">
          Мои дегустации
        </h1>

        {/* Счётчик — top: 90px по Figma */}
        <div className="mt-3">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#78716c] text-[#fafafa] text-[12px] font-semibold leading-[16px]">
            {tastings.length} записей
          </span>
        </div>

        {/* Список карточек — top: 134px, gap: 8px по Figma */}
        <div className="flex flex-col gap-2 mt-6 pb-8">
          {tastings.map((t) => (
            <Link key={t.id} href={`/tastings/${t.id}`}>
              <article className="bg-[#fafaf9] rounded-lg overflow-hidden flex flex-col gap-4 pb-4">
                {/* Изображение — высота 166px по Figma */}
                <div className="relative h-[166px] overflow-hidden shrink-0 w-full">
                  {t.cover_url ? (
                    <Image
                      src={t.cover_url}
                      alt={t.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-[#e7e5e4]" />
                  )}

                  {/* Рейтинг — чип в правом верхнем углу */}
                  {t.rating > 0 && (
                    <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-white/90 rounded-lg px-2 py-1 min-h-[29px]">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" fill="#0a0a0a"/>
                      </svg>
                      <span className="text-[12px] font-semibold leading-[16px] text-[#0a0a0a] whitespace-nowrap">
                        {t.rating}/10
                      </span>
                    </div>
                  )}

                  {/* Метка быстрой заметки */}
                  {t.entry_mode === 'quick' && (
                    <div className="absolute top-2 left-2 bg-white/90 rounded-lg px-2 py-1 min-h-[29px] flex items-center">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" fill="#0a0a0a"/>
                      </svg>
                    </div>
                  )}
                </div>

                {/* Текст и бейджи */}
                <div className="flex flex-col gap-2 px-4">
                  <p className="font-[family-name:var(--font-geist-sans)] text-[16px] font-semibold leading-[24px] text-black">
                    {t.name}
                  </p>
                  <div className="flex flex-wrap gap-1 items-center">
                    <CategoryBadge category={t.category} />
                    {t.year && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-[#d4d4d4] text-[12px] font-semibold leading-[16px] text-[#0a0a0a]">
                        {t.year}
                      </span>
                    )}
                    {t.region && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-[#d4d4d4] text-[12px] font-semibold leading-[16px] text-[#0a0a0a]">
                        {t.region}
                      </span>
                    )}
                  </div>
                </div>
              </article>
            </Link>
          ))}

          {tastings.length === 0 && (
            <p className="text-[#78716c] text-[14px] text-center py-12">
              Пока нет записей
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
