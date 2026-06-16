export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { getTastings, getTeawareList } from '@/lib/api';
import TastingCard, { TastingItem } from '@/components/TastingCard';
import PaginationLinks from '@/components/PaginationLinks';
import SearchControls, { type TeawareFilterItem } from '@/components/SearchControls';
import EmptyTastings from '@/components/EmptyTastings';

const PAGE_SIZE = 10;

type SearchParams = {
  page?: string;
  q?: string;
  cat?: string;
  tw?: string;
  rating?: string;
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const filter = {
    q: sp.q ?? '',
    categories: sp.cat ?? '',
    teawareIds: sp.tw ?? '',
    ratingMin: parseInt(sp.rating ?? '0', 10) || 0,
  };
  const hasFilter = Boolean(filter.q || filter.categories || filter.teawareIds || filter.ratingMin);

  const [data, teawareData] = await Promise.all([
    getTastings(PAGE_SIZE, offset, filter) as Promise<{ items: TastingItem[]; total: number }>,
    getTeawareList().catch(() => ({ items: [] })) as Promise<{ items: TeawareFilterItem[] }>,
  ]);
  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

  // Пагинация сохраняет активный поиск/фильтры
  const baseParams = new URLSearchParams();
  if (sp.q) baseParams.set('q', sp.q);
  if (sp.cat) baseParams.set('cat', sp.cat);
  if (sp.tw) baseParams.set('tw', sp.tw);
  if (sp.rating) baseParams.set('rating', sp.rating);

  function buildHref(p: number): string {
    const params = new URLSearchParams(baseParams);
    if (p > 1) params.set('page', String(p));
    const qs = params.toString();
    return qs ? `/?${qs}` : '/';
  }

  const teawareItems = teawareData.items.map((t) => ({
    id: t.id,
    name: t.name,
    cover_url: t.cover_url ?? null,
  }));

  const isEmpty = data.total === 0 && !hasFilter;

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4">
        {isEmpty ? (
          <>
            <h1 className="pt-12 text-[32px] font-semibold leading-[32px] tracking-[-1px] text-foreground">
              Мои дегустации
            </h1>
            <div className="mt-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-badge-neutral-bg text-badge-neutral-text text-[12px] font-semibold leading-[16px]">
                0 записей
              </span>
            </div>
            <EmptyTastings />
          </>
        ) : (
          <>
            <Suspense fallback={null}>
              <SearchControls teaware={teawareItems} />
            </Suspense>

            <div className="mt-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-badge-neutral-bg text-badge-neutral-text text-[12px] font-semibold leading-[16px]">
                {data.total} записей
              </span>
            </div>

            <div className="flex flex-col gap-3 mt-4 pb-4">
              {data.items.map((item) => (
                <TastingCard key={item.id} item={item} />
              ))}

              {data.items.length === 0 && (
                <p className="text-muted-foreground text-[14px] text-center py-12">
                  Ничего не найдено. Измените запрос или фильтры.
                </p>
              )}
            </div>

            <PaginationLinks
              current={page}
              total={totalPages}
              buildHref={buildHref}
            />
          </>
        )}
      </div>
    </main>
  );
}
