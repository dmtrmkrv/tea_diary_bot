'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { LeafIcon, StackIcon, PlusIcon } from '@phosphor-icons/react';
import TeaCard from '@/components/collection/TeaCard';
import TeaDetailSheet from '@/components/collection/TeaDetailSheet';
import TeawareCard from '@/components/collection/TeawareCard';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import PaginationButtons from '@/components/PaginationButtons';
import {
  getTeaCollection,
  getTeawareCollection,
  deleteTeaware,
  type TeaItem,
  type Teaware,
} from '@/lib/apiClient';

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
  const [page, setPage] = useState(1);
  const [wItems, setWItems] = useState<Teaware[]>([]);
  const [teawareTotal, setTeawareTotal] = useState(0);
  const [wPage, setWPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TeaItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Teaware | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tea, teaware] = await Promise.all([
        getTeaCollection(PAGE_SIZE, (page - 1) * PAGE_SIZE),
        getTeawareCollection(PAGE_SIZE, (wPage - 1) * PAGE_SIZE).catch(
          () => ({ items: [], total: 0 })
        ),
      ]);
      setItems(tea.items);
      setTotal(tea.total);
      setWItems(teaware.items);
      setTeawareTotal(teaware.total);
    } finally {
      setLoading(false);
    }
  }, [page, wPage]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handler = () => { load(); };
    window.addEventListener('tea:added', handler);
    window.addEventListener('teaware:added', handler);
    return () => {
      window.removeEventListener('tea:added', handler);
      window.removeEventListener('teaware:added', handler);
    };
  }, [load]);

  function openAddSheet(name: 'tea' | 'teaware') {
    const params = new URLSearchParams(searchParams.toString());
    params.set('add', name);
    router.push(`${pathname}?${params.toString()}`);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      await deleteTeaware(target.id);
      toast.success('Посуда удалена');
      load();
    } catch {
      toast.error('Не удалось удалить посуду. Попробуйте ещё раз.');
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const wTotalPages = Math.max(1, Math.ceil(teawareTotal / PAGE_SIZE));

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 pt-12 flex flex-col gap-4">
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

      <div className="max-w-2xl mx-auto px-4 mt-4 pb-4">
        {loading ? (
          <p className="text-center text-[14px] text-muted-foreground pt-8">Загрузка…</p>
        ) : tab === 'teaware' ? (
          wItems.length === 0 ? (
            <div className="flex flex-col items-center gap-8 pt-16 pb-8 px-4 text-center">
              <div className="flex flex-col items-center gap-4">
                <span className="w-[90px] h-[90px] rounded-full bg-card flex items-center justify-center">
                  <StackIcon size={40} className="text-placeholder-tea-icon" />
                </span>
                <div className="flex flex-col gap-3">
                  <p className="text-[20px] font-semibold text-text-secondary">Коллекция пустая</p>
                  <p className="text-[14px] text-muted-foreground">
                    Добавь посуду, чтобы привязывать<br />
                    ее к дегустациям
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => openAddSheet('teaware')}
                className="flex items-center gap-2 h-10 px-6 rounded-full bg-primary text-primary-foreground text-[14px] font-medium"
              >
                <PlusIcon size={16} weight="bold" />
                Добавить посуду
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                {wItems.map((item) => (
                  <TeawareCard
                    key={item.id}
                    item={item}
                    onClick={() => { /* TODO: TeawareItemSheet — шаг E */ }}
                    onDelete={() => setDeleteTarget(item)}
                  />
                ))}
              </div>

              <PaginationButtons
                current={wPage}
                total={wTotalPages}
                onPageChange={setWPage}
              />
            </>
          )
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
              onClick={() => openAddSheet('tea')}
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

      <ConfirmDeleteDialog
        open={deleteTarget != null}
        title={`Удалить «${deleteTarget?.name ?? ''}»?`}
        description={
          deleteTarget && deleteTarget.tasting_count > 0
            ? `Связанные дегустации (${deleteTarget.tasting_count}) останутся, но потеряют привязку к посуде.`
            : 'Действие нельзя отменить.'
        }
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </main>
  );
}
