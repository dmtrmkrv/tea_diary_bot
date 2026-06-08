'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { LeafIcon, StackIcon, PlusIcon } from '@phosphor-icons/react';
import TeaCard from '@/components/collection/TeaCard';
import TeaDetailSheet from '@/components/collection/TeaDetailSheet';
import PaginationButtons from '@/components/PaginationButtons';
import { getTeaCollection, getTeawareCollection, type TeaItem } from '@/lib/apiClient';

const PAGE_SIZE = 10;

export default function CollectionPage() {
  return (
    <Suspense fallback={null}>
      <CollectionInner />
    </Suspense>
  );
}

function CollectionInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<'tea' | 'teaware'>('tea');
  const [items, setItems] = useState<TeaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [teawareTotal, setTeawareTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TeaItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const offset = (page - 1) * PAGE_SIZE;
      const [tea, teaware] = await Promise.all([
        getTeaCollection(PAGE_SIZE, offset),
        getTeawareCollection(1, 0).catch(() => ({ items: [], total: 0 })),
      ]);
      setItems(tea.items);
      setTotal(tea.total);
      setTeawareTotal(teaware.total);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handler = () => { load(); };
    window.addEventListener('tea:added', handler);
    return () => window.removeEventListener('tea:added', handler);
  }, [load]);

  function openAddSheet() {
    const params = new URLSearchParams(searchParams.toString());
    params.set('add', 'tea');
    router.push(`${pathname}?${params.toString()}`);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="min-h-screen bg-background">
      <div className="px-4 pt-12 flex flex-col gap-4">
        <h1 className="text-[32px] leading-[32px] font-semibold tracking-[-1px] text-foreground">
          Моя коллекция
        </h1>

        <div className="bg-surface-sunken rounded-full p-1 flex gap-1">
          <button
            type="button"
            onClick={() => setTab('tea')}
            className={`flex-1 h-8 rounded-full flex items-center justify-center gap-2 text-[14px] font-medium transition-colors ${
              tab === 'tea' ? 'bg-surface-elevated shadow-xs text-foreground' : 'text-foreground'
            }`}
          >
            Чай
            <span className="bg-surface-sunken-strong rounded-[10px] h-4 min-w-4 px-1 text-[12px] font-semibold flex items-center justify-center">
              {total}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab('teaware')}
            className={`flex-1 h-8 rounded-full flex items-center justify-center gap-2 text-[14px] font-medium transition-colors ${
              tab === 'teaware' ? 'bg-surface-elevated shadow-xs text-foreground' : 'text-foreground'
            }`}
          >
            Посуда
            <span className="bg-surface-sunken-strong rounded-[10px] h-4 min-w-4 px-1 text-[12px] font-semibold flex items-center justify-center">
              {teawareTotal}
            </span>
          </button>
        </div>
      </div>

      <div className="px-4 mt-4 pb-4">
        {tab === 'teaware' ? (
          <div className="flex flex-col items-center gap-3 pt-16 pb-8 px-4 text-center">
            <span className="w-[90px] h-[90px] rounded-full bg-card flex items-center justify-center">
              <StackIcon size={40} className="text-placeholder-tea-icon" />
            </span>
            <p className="text-[20px] font-semibold text-text-secondary">Скоро будет</p>
            <p className="text-[14px] text-muted-foreground">Раздел посуды в разработке</p>
          </div>
        ) : loading ? (
          <p className="text-center text-[14px] text-muted-foreground pt-8">Загрузка…</p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-8 pt-16 pb-8 px-4 text-center">
            <div className="flex flex-col items-center gap-4">
              <span className="w-[90px] h-[90px] rounded-full bg-card flex items-center justify-center">
                <LeafIcon size={40} className="text-placeholder-tea-icon" />
              </span>
              <div className="flex flex-col gap-3">
                <p className="text-[20px] font-semibold text-text-secondary">Коллекция пустая</p>
                <p className="text-[14px] text-muted-foreground">
                  Добавь первый сорт чая,<br />
                  чтобы привязывать его к дегустациям
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={openAddSheet}
              className="flex items-center gap-2 h-10 px-6 rounded-full bg-primary text-primary-foreground text-[14px] font-medium"
            >
              <PlusIcon size={16} weight="bold" />
              Добавить чай
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              {items.map((item) => (
                <TeaCard
                  key={item.id}
                  item={item}
                  onClick={() => setSelected(item)}
                />
              ))}
            </div>

            <PaginationButtons
              current={page}
              total={totalPages}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      <TeaDetailSheet item={selected} onClose={() => setSelected(null)} />
    </main>
  );
}
