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
  created_at: string | null;
  cover_url: string | null;
}

function formatDatetime(isoString: string | null): string | null {
  if (!isoString) return null;
  const iso = isoString.endsWith('Z') ? isoString : isoString + 'Z';
  const date = new Date(iso);
  const datePart = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(date);
  const h = date.getUTCHours(), m = date.getUTCMinutes();
  if (h === 0 && m === 0) return datePart;
  return `${datePart}, ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function StarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M7.239 2.34c.3-.921 1.603-.921 1.902 0l.856 2.634a1 1 0 00.951.69h2.77c.969 0 1.371 1.24.588 1.81l-2.24 1.627a1 1 0 00-.364 1.118l.856 2.634c.3.921-.755 1.688-1.54 1.118l-2.24-1.627a1 1 0 00-1.175 0l-2.24 1.627c-.784.57-1.838-.197-1.539-1.118l.856-2.634a1 1 0 00-.364-1.118L1.694 7.474c-.783-.57-.38-1.81.588-1.81h2.77a1 1 0 00.951-.69l.856-2.634z"/>
    </svg>
  );
}

function LightningIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M9.04 1.037A1 1 0 019.6 2v4h3.2a1 1 0 01.82 1.573l-5.6 8A1 1 0 016.4 15v-4H3.2a1 1 0 01-.82-1.573l5.6-8a1 1 0 011.06-.39z"/>
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" xmlns="http://www.w3.org/2000/svg">
      <circle cx="7" cy="7" r="5"/>
      <path d="M12 12l2.5 2.5" strokeLinecap="round"/>
    </svg>
  );
}

export default async function Home() {
  const tastings: Tasting[] = await getTastings();

  return (
    <main className="min-h-screen bg-[#e7e5e4]">
      <div className="max-w-2xl mx-auto px-4">
        {/* Заголовок */}
        <div className="flex items-center justify-between pt-[48px]">
          <h1 className="font-[family-name:var(--font-inter)] text-[32px] font-semibold leading-[32px] tracking-[-1px] text-[#0a0a0a]">
            Мои дегустации
          </h1>
          <button className="flex items-center justify-center w-9 h-9 bg-[#f5f5f5] rounded-lg text-[#0a0a0a]">
            <SearchIcon />
          </button>
        </div>

        {/* Счётчик */}
        <div className="mt-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#a8a29e] text-[#fafafa] text-[12px] font-semibold leading-[16px]">
            {tastings.length} записей
          </span>
        </div>

        {/* Список карточек */}
        <div className="flex flex-col gap-3 mt-4 pb-8">
          {tastings.map((t) => {
            const datetime = formatDatetime(t.created_at);
            const isQuick = t.entry_mode === 'quick';
            const hasRating = t.rating > 0;

            return (
              <Link key={t.id} href={`/tastings/${t.id}`}>
                <article className="bg-[#fafaf9] rounded-lg overflow-hidden shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1),0px_4px_6px_-4px_rgba(0,0,0,0.1)]">

                  {/* Фото — только если есть */}
                  {t.cover_url && (
                    <div className="relative h-[176px] w-full shrink-0">
                      <Image src={t.cover_url} alt={t.name} fill className="object-cover" />
                    </div>
                  )}

                  {/* Контент */}
                  <div className="flex flex-col gap-2 px-4 py-4">

                    {/* Строка: дата + рейтинг/быстрая заметка */}
                    {(datetime || isQuick || hasRating) && (
                      <div className="flex items-center justify-between">
                        <span className="text-[#78716c] text-[12px] font-medium leading-[16px] whitespace-nowrap">
                          {datetime}
                        </span>
                        <div className="flex items-center gap-1">
                          {isQuick && (
                            <div className="flex items-center justify-center min-h-[20px] min-w-[20px] px-1 py-0.5 rounded-full border border-[#f59e0b] text-[#f59e0b]">
                              <LightningIcon />
                            </div>
                          )}
                          {hasRating && (
                            <div className="flex items-center gap-1 min-h-[20px] px-2 py-0.5 rounded-full border border-[#f59e0b] text-[#f59e0b]">
                              <StarIcon />
                              <span className="text-[12px] font-medium leading-[16px] whitespace-nowrap">
                                {t.rating}/10
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Название */}
                    <p className="font-[family-name:var(--font-inter)] text-[16px] font-semibold leading-[24px] text-[#0a0a0a]">
                      {t.name}
                    </p>

                    {/* Бейджи */}
                    {(t.year || t.region) && (
                      <div className="flex flex-wrap gap-1 items-center">
                        <CategoryBadge category={t.category} />
                        {t.year && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-[#d4d4d4] bg-[rgba(255,255,255,0.5)] text-[12px] font-semibold leading-[16px] text-[#0a0a0a]">
                            {t.year}
                          </span>
                        )}
                        {t.region && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-[#d4d4d4] bg-[rgba(255,255,255,0.5)] text-[12px] font-semibold leading-[16px] text-[#0a0a0a]">
                            {t.region}
                          </span>
                        )}
                      </div>
                    )}
                    {!t.year && !t.region && t.category && (
                      <div className="flex flex-wrap gap-1 items-center">
                        <CategoryBadge category={t.category} />
                      </div>
                    )}
                  </div>
                </article>
              </Link>
            );
          })}

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
