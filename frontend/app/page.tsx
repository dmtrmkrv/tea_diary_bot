export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { unstable_rethrow } from 'next/navigation';
import LandingPage from '@/components/landing/LandingPage';
import { getTastings, getTeawareList, getMe } from '@/lib/api';
import TastingCard, { TastingItem } from '@/components/TastingCard';
import PaginationLinks from '@/components/PaginationLinks';
import SearchControls, { type TeawareFilterItem } from '@/components/SearchControls';
import EmptyTastings from '@/components/EmptyTastings';
import EmptySearch from '@/components/EmptySearch';
import OnboardingGate from '@/components/OnboardingGate';

const PAGE_SIZE = 10;

// Незалогиненным на «/» показываем лендинг (proxy.ts пускает «/» без токена),
// залогиненным — ленту. Метаданные тоже ветвятся: у лендинга свои title/description.
export async function generateMetadata(): Promise<Metadata> {
  const hasToken = (await cookies()).has('token');
  if (hasToken) return { title: 'Чайный дневник', description: 'Записи чайных дегустаций' };
  const title = 'LeafPulse — личный чайный дневник';
  const description =
    'Записывайте дегустации, ведите коллекцию чая и посуды, отслеживайте любимые вкусы. Всё в одном месте.';
  return {
    title,
    description,
    // OG/Twitter — превью ссылки в Telegram и соцсетях (абсолютные URL
    // собираются из metadataBase в app/layout.tsx)
    openGraph: {
      title,
      description,
      url: '/',
      siteName: 'LeafPulse',
      locale: 'ru_RU',
      type: 'website',
      images: [{ url: '/landing/og.jpg', width: 1200, height: 630, alt: 'LeafPulse — личный чайный дневник' }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/landing/og.jpg'],
    },
  };
}

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
  // Нет токена — публичный лендинг, без запросов к API.
  if (!(await cookies()).has('token')) {
    return <LandingPage />;
  }

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

  const [data, teawareData, me] = await Promise.all([
    getTastings(PAGE_SIZE, offset, filter) as Promise<{ items: TastingItem[]; total: number }>,
    getTeawareList().catch((e) => { unstable_rethrow(e); return { items: [] }; }) as Promise<{ items: TeawareFilterItem[] }>,
    getMe().catch((e) => { unstable_rethrow(e); return null; }) as Promise<{ tz_offset_min: number } | null>,
  ]);
  const tzOffset = me?.tz_offset_min ?? 0;
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
      <OnboardingGate />
      <div className="max-w-2xl mx-auto px-4">
        <Suspense fallback={null}>
          <SearchControls teaware={teawareItems} />
        </Suspense>

        <div className="mt-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-badge-neutral-bg text-badge-neutral-text text-[12px] font-semibold leading-[16px]">
            {data.total} записей
          </span>
        </div>

        {isEmpty ? (
          <EmptyTastings />
        ) : (
          <>
            <div className="flex flex-col gap-3 mt-4 pb-4">
              {data.items.map((item) => (
                <TastingCard key={item.id} item={item} tzOffset={tzOffset} />
              ))}

              {data.items.length === 0 && <EmptySearch />}
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
