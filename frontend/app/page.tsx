export const dynamic = 'force-dynamic';

import { getTastings } from '@/lib/api';
import TastingCard, { TastingItem } from '@/components/TastingCard';
import PaginationLinks from '@/components/PaginationLinks';

const PAGE_SIZE = 10;

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="7" cy="7" r="5"/>
      <path d="M12 12l2.5 2.5" strokeLinecap="round"/>
    </svg>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const data: { items: TastingItem[]; total: number } = await getTastings(PAGE_SIZE, offset);
  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4">
        <div className="flex items-center justify-between pt-12">
          <h1 className="text-[32px] font-semibold leading-[32px] tracking-[-1px] text-foreground">
            Мои дегустации
          </h1>
          <button className="flex items-center justify-center w-9 h-9 bg-muted rounded-lg text-foreground">
            <SearchIcon />
          </button>
        </div>

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
              Пока нет записей
            </p>
          )}
        </div>

        <PaginationLinks
          current={page}
          total={totalPages}
          buildHref={(p) => (p === 1 ? '/' : `/?page=${p}`)}
        />
      </div>
    </main>
  );
}
