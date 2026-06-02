'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { XIcon, LeafIcon, CaretRightIcon } from '@phosphor-icons/react';
import { getTeaItemTastings, type TeaItem, type TastingShort } from '@/lib/apiClient';
import CategoryBadge from '@/components/CategoryBadge';
import PaginationButtons from '@/components/PaginationButtons';

const PAGE_SIZE = 4;

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const date = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(d);
  const h = d.getUTCHours(), m = d.getUTCMinutes();
  if (h === 0 && m === 0) return date;
  return `${date}, ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export default function TeaItemSheet({
  item,
  onClose,
}: {
  item: TeaItem;
  onClose: () => void;
}) {
  const router = useRouter();
  const [tastings, setTastings] = useState<TastingShort[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const loadTastings = useCallback((p: number) => {
    setLoading(true);
    getTeaItemTastings(item.id, PAGE_SIZE, (p - 1) * PAGE_SIZE)
      .then(res => {
        setTastings(res.items);
        setTotal(res.total);
      })
      .catch(() => setTastings([]))
      .finally(() => setLoading(false));
  }, [item.id]);

  useEffect(() => {
    setPage(1);
    loadTastings(1);
  }, [item.id, loadTastings]);

  function handlePageChange(p: number) {
    setPage(p);
    loadTastings(p);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-0 right-0 bottom-0 z-[70] bg-white rounded-t-[24px] flex flex-col h-[785px] overflow-hidden">

        {/* Cover image */}
        <div className="relative h-[190px] shrink-0 rounded-t-[24px] overflow-hidden bg-[#f5f5f4]">
          {item.cover_url ? (
            <Image src={item.cover_url} alt={item.name} fill className="object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <LeafIcon size={48} className="text-[#a8a29e]" />
            </div>
          )}
          {/* Handle */}
          <div className="absolute top-3 left-0 right-0 flex justify-center">
            <span className="w-10 h-1 rounded-[2px] bg-[rgba(255,255,255,0.6)]" />
          </div>
          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-4 w-6 h-6 rounded-full bg-[rgba(0,0,0,0.8)] flex items-center justify-center"
          >
            <XIcon size={11} className="text-white" weight="bold" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4 px-4 pt-4 pb-2">

          {/* Title + badges */}
          <div className="flex flex-col gap-3">
            <h2 className="text-[20px] font-semibold leading-6 text-[#0a0a0a]">{item.name}</h2>
            <div className="flex flex-wrap gap-1">
              {item.category && <CategoryBadge category={item.category} />}
              {item.year && (
                <span className="border border-[#d4d4d4] bg-[rgba(255,255,255,0.5)] rounded-full px-2 py-0.5 text-[12px] font-semibold leading-[16px] text-[#0a0a0a]">
                  {item.year}
                </span>
              )}
              {item.region && (
                <span className="border border-[#d4d4d4] bg-[rgba(255,255,255,0.5)] rounded-full px-2 py-0.5 text-[12px] font-semibold leading-[16px] text-[#0a0a0a]">
                  {item.region}
                </span>
              )}
            </div>
          </div>

          {/* Tastings section */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <p className="text-[18px] font-medium text-[#0a0a0a]">Дегустации</p>
              <span className="bg-[#a8a29e] rounded-full px-2 py-0.5 text-[12px] font-semibold text-white leading-[16px]">
                {total}
              </span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <span className="w-5 h-5 rounded-full border-2 border-[#d6d3d1] border-t-[#b45309] animate-spin" />
              </div>
            ) : tastings.length === 0 ? (
              <p className="text-[14px] text-[#78716c] py-4">Дегустации ещё не добавлены</p>
            ) : (
              <div className="flex flex-col gap-2">
                {tastings.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => { onClose(); router.push(`/tastings/${t.id}`); }}
                    className="bg-[#f5f5f4] flex gap-3 items-center pl-2 pr-4 py-2 rounded-2xl shadow-[0px_1px_2px_rgba(0,0,0,0.05),0px_1px_1px_rgba(0,0,0,0.05)] text-left"
                  >
                    <div className="w-[50px] h-[50px] shrink-0 rounded-[10px] overflow-hidden bg-[#e7e5e4] relative border border-black/10">
                      {(t as any).photo_url ? (
                        <Image src={(t as any).photo_url} alt={t.name} fill className="object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <LeafIcon size={18} className="text-[#a8a29e]" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <p className="text-[12px] font-medium text-[#78716c] leading-4">
                        {formatDate(t.created_at)}
                      </p>
                      <p className="text-[14px] font-semibold text-[#0a0a0a] truncate leading-5">{t.name}</p>
                    </div>
                    <CaretRightIcon size={24} className="text-[#a8a29e] shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <PaginationButtons
                current={page}
                total={totalPages}
                onPageChange={handlePageChange}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-4 pb-8 pt-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-[122px] h-12 rounded-full bg-[#f5f5f5] text-[16px] font-medium text-[#737373] shrink-0"
          >
            Закрыть
          </button>
          <button
            type="button"
            onClick={() => { onClose(); router.push(`/new?tea_item_id=${item.id}`); }}
            className="flex-1 h-12 rounded-full bg-[#b45309] text-[16px] font-medium text-white"
          >
            Новая дегустация
          </button>
        </div>
      </div>
    </>
  );
}
