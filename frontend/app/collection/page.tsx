'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { LeafIcon, StackIcon, PlusIcon } from '@phosphor-icons/react';
import TeaCard from '@/components/collection/TeaCard';
import TeaDetailSheet from '@/components/collection/TeaDetailSheet';
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
    <main className="min-h-screen bg-[#e7e5e4]">
      <div className="px-4 pt-12 flex flex-col gap-4">
        <h1 className="text-[32px] leading-[32px] font-semibold tracking-[-1px] text-[#0a0a0a]">
          Моя коллекция
        </h1>

        <div className="bg-black/5 rounded-full p-1 flex gap-1">
          <button
            type="button"
            onClick={() => setTab('tea')}
            className={`flex-1 h-8 rounded-full flex items-center justify-center gap-2 text-[14px] font-medium transition-colors ${
              tab === 'tea' ? 'bg-white shadow-sm text-[#0a0a0a]' : 'text-[#0a0a0a]'
            }`}
          >
            Чай
            <span className="bg-black/15 rounded-[10px] h-4 min-w-4 px-1 text-[12px] font-semibold flex items-center justify-center">
              {total}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab('teaware')}
            className={`flex-1 h-8 rounded-full flex items-center justify-center gap-2 text-[14px] font-medium transition-colors ${
              tab === 'teaware' ? 'bg-white shadow-sm text-[#0a0a0a]' : 'text-[#0a0a0a]'
            }`}
          >
            Посуда
            <span className="bg-black/15 rounded-[10px] h-4 min-w-4 px-1 text-[12px] font-semibold flex items-center justify-center">
              {teawareTotal}
            </span>
          </button>
        </div>
      </div>

      <div className="px-4 mt-4 pb-4">
        {tab === 'teaware' ? (
          <div className="flex flex-col items-center gap-3 pt-16 pb-8 px-4 text-center">
            <span className="w-[90px] h-[90px] rounded-full bg-[#fafaf9] flex items-center justify-center">
              <StackIcon size={40} className="text-[#a8a29e]" />
            </span>
            <p className="text-[20px] font-semibold text-[#57534e]">Скоро будет</p>
            <p className="text-[14px] text-[#78716c]">Раздел посуды в разработке</p>
          </div>
        ) : loading ? (
          <p className="text-center text-[14px] text-[#78716c] pt-8">Загрузка…</p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-8 pt-16 pb-8 px-4 text-center">
            <div className="flex flex-col items-center gap-4">
              <span className="w-[90px] h-[90px] rounded-full bg-[#fafaf9] flex items-center justify-center">
                <LeafIcon size={40} className="text-[#a8a29e]" />
              </span>
              <div className="flex flex-col gap-3">
                <p className="text-[20px] font-semibold text-[#57534e]">Коллекция пустая</p>
                <p className="text-[14px] text-[#78716c]">
                  Добавь первый сорт чая,<br />
                  чтобы привязывать его к дегустациям
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={openAddSheet}
              className="flex items-center gap-2 h-10 px-6 rounded-full bg-[#b45309] text-white text-[14px] font-medium"
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

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="px-3 h-8 text-[14px] text-[#57534e] disabled:opacity-40"
                >
                  Назад
                </button>
                <span className="text-[14px] text-[#1c1917] px-2">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page === totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="px-3 h-8 text-[14px] text-[#57534e] disabled:opacity-40"
                >
                  Вперёд
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <TeaDetailSheet item={selected} onClose={() => setSelected(null)} />
    </main>
  );
}
