'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { XIcon, LeafIcon, BowlSteamIcon, CaretRightIcon } from '@phosphor-icons/react';
import CategoryBadge from '@/components/CategoryBadge';
import { getTeaItemTastings, type TeaItem, type TastingShort } from '@/lib/apiClient';

const PAGE_SIZE = 3;

function formatDate(s: string): string {
  const d = new Date(s);
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(d) + ', ' + String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
}

type LoadedData = { key: string; items: TastingShort[]; total: number };

export default function TeaDetailSheet({
  item,
  onClose,
}: {
  item: TeaItem | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pageState, setPageState] = useState<{ itemId: number; page: number }>({
    itemId: 0,
    page: 1,
  });
  const page = item && pageState.itemId === item.id ? pageState.page : 1;

  function setPage(updater: (prev: number) => number) {
    if (!item) return;
    setPageState((prev) => {
      const current = prev.itemId === item.id ? prev.page : 1;
      return { itemId: item.id, page: updater(current) };
    });
  }

  const loadKey = item ? `${item.id}-${page}` : null;
  const [data, setData] = useState<LoadedData | null>(null);

  useEffect(() => {
    if (!item || !loadKey) return;
    let cancelled = false;
    const offset = (page - 1) * PAGE_SIZE;
    getTeaItemTastings(item.id, PAGE_SIZE, offset)
      .then((res) => {
        if (cancelled) return;
        setData({ key: loadKey, items: res.items, total: res.total });
      })
      .catch(() => {
        if (cancelled) return;
        setData({ key: loadKey, items: [], total: 0 });
      });
    return () => { cancelled = true; };
  }, [item, page, loadKey]);

  if (!item) return null;

  const loading = data?.key !== loadKey;
  const tastings = !loading && data ? data.items : [];
  const total = !loading && data ? data.total : 0;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasTastings = total > 0;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-overlay-scrim backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 -translate-x-1/2 bottom-0 w-full max-w-2xl z-[70] bg-card rounded-t-3xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="flex justify-center pt-2 pb-1">
          <span className="w-9 h-1 rounded-full bg-border-strong" />
        </div>

        <div className="relative px-4 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-2 right-4 z-10 w-8 h-8 rounded-full bg-overlay-dialog flex items-center justify-center"
          >
            <XIcon size={16} className="text-text-light" weight="bold" />
          </button>

          <div className="relative w-full aspect-[2/1] rounded-2xl overflow-hidden bg-card flex items-center justify-center">
            {item.cover_url ? (
              <Image src={item.cover_url} alt={item.name} fill className="object-cover" />
            ) : (
              <LeafIcon size={64} className="text-placeholder-tea-icon" />
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4 flex flex-col gap-3">
          <h2 className="text-[20px] leading-[24px] font-semibold text-foreground">
            {item.name}
          </h2>

          <div className="flex flex-wrap gap-1">
            {item.category && <CategoryBadge category={item.category} />}
            {item.year != null && (
              <span className="border border-badge-tag-border bg-badge-tag-bg rounded-full px-2 py-0.5 text-[12px] font-semibold leading-[16px] text-badge-tag-text">
                {item.year}
              </span>
            )}
            {item.region && (
              <span className="border border-badge-tag-border bg-badge-tag-bg rounded-full px-2 py-0.5 text-[12px] font-semibold leading-[16px] text-badge-tag-text">
                {item.region}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-2">
            <h3 className="text-[16px] font-semibold text-foreground">Дегустации</h3>
            <span className="bg-surface-sunken-strong rounded-full px-2 h-4 flex items-center text-[12px] font-semibold text-foreground">
              {total}
            </span>
          </div>

          {loading ? (
            <p className="text-[14px] text-muted-foreground">Загрузка…</p>
          ) : hasTastings ? (
            <>
              <div className="flex flex-col gap-2">
                {tastings.map((t) => (
                  <Link
                    key={t.id}
                    href={`/tastings/${t.id}`}
                    onClick={onClose}
                    className="bg-surface-sunken rounded-xl px-3 py-2 flex items-center gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] leading-[16px] text-muted-foreground">
                        {formatDate(t.created_at)}
                      </p>
                      <p className="text-[14px] leading-[20px] font-medium text-foreground truncate">
                        {t.name}
                      </p>
                    </div>
                    <CaretRightIcon size={20} className="text-muted-foreground shrink-0" />
                  </Link>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-1 pt-2">
                  <button
                    type="button"
                    disabled={page === 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="px-3 h-8 text-[14px] text-text-secondary disabled:opacity-40"
                  >
                    Назад
                  </button>
                  <span className="text-[14px] text-foreground px-2">
                    {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page === totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    className="px-3 h-8 text-[14px] text-text-secondary disabled:opacity-40"
                  >
                    Вперёд
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="border border-border-default rounded-2xl py-8 flex flex-col items-center gap-2">
              <span className="w-12 h-12 rounded-full bg-placeholder-tea-bg flex items-center justify-center">
                <BowlSteamIcon size={24} className="text-muted-foreground" />
              </span>
              <p className="text-[16px] font-semibold text-text-secondary">Дегустаций нет</p>
              <p className="text-[12px] text-muted-foreground text-center px-6">
                Создайте новую дегустацию с этим сортом.
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2 p-4 border-t border-border-default bg-card">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-10 rounded-full bg-surface-sunken text-[14px] font-medium text-foreground"
          >
            Закрыть
          </button>
          <button
            type="button"
            onClick={() => {
              if (item) router.push(`/new?tea_item_id=${item.id}`);
            }}
            className="flex-[2] h-10 rounded-full bg-primary text-[14px] font-medium text-primary-foreground"
          >
            Новая дегустация
          </button>
        </div>
      </div>
    </>
  );
}
