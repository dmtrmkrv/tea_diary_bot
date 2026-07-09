'use client';

import { AppButton } from '@/components/ui/app-button';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  XIcon,
  ImageSquareIcon,
  BowlSteamIcon,
  CaretRightIcon,
  DotsThreeIcon,
  LeafIcon,
} from '@phosphor-icons/react';
import {
  getTeawareTastings,
  deleteTeaware,
  getMe,
  type Teaware,
  type TastingShort,
} from '@/lib/apiClient';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import PaginationButtons from '@/components/PaginationButtons';
import NotesSection from '@/components/NotesSection';
import { formatTastingDatetime } from '@/lib/datetime';

const PAGE_SIZE = 4;

type LoadedData = { key: string; items: TastingShort[]; total: number };

export default function TeawareItemSheet({
  item,
  onClose,
  onDeleted,
}: {
  item: Teaware | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const router = useRouter();
  const [pageState, setPageState] = useState<{ itemId: number; page: number }>({
    itemId: 0,
    page: 1,
  });
  const page = item && pageState.itemId === item.id ? pageState.page : 1;

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useBodyScrollLock(item != null);

  useEffect(() => {
    if (!menuOpen) return;
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  function setPage(updater: (prev: number) => number) {
    if (!item) return;
    setPageState((prev) => {
      const current = prev.itemId === item.id ? prev.page : 1;
      return { itemId: item.id, page: updater(current) };
    });
  }

  const loadKey = item ? `${item.id}-${page}` : null;
  const [data, setData] = useState<LoadedData | null>(null);

  // Часовой пояс пользователя — чтобы время совпадало с карточкой/списком.
  const [tzOffset, setTzOffset] = useState(0);
  useEffect(() => {
    let cancelled = false;
    getMe().then((me) => { if (!cancelled) setTzOffset(me.tz_offset_min ?? 0); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!item || !loadKey) return;
    let cancelled = false;
    const offset = (page - 1) * PAGE_SIZE;
    getTeawareTastings(item.id, PAGE_SIZE, offset)
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

  const tags = [item.region, item.material, item.volume_ml != null ? `${item.volume_ml} мл` : null]
    .filter(Boolean) as string[];

  async function handleDelete() {
    if (!item) return;
    setConfirmDelete(false);
    try {
      await deleteTeaware(item.id);
      toast.success('Посуда удалена');
      onClose();
      onDeleted();
    } catch {
      toast.error('Не удалось удалить посуду. Попробуйте ещё раз.');
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-overlay-scrim backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 -translate-x-1/2 bottom-0 w-full max-w-2xl z-[70] bg-card rounded-t-[24px] flex flex-col max-h-[calc(100svh-48px)] overflow-hidden">

        {/* Скролл-область: фото — часть контента и уезжает при прокрутке
            (постоянное закрытие — крестик в футере и тап по скриму) */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col">
        {/* Cover */}
        <div className="relative aspect-[2/1] shrink-0 rounded-3xl overflow-hidden bg-surface-app">
          {item.cover_url ? (
            <Image src={item.cover_url} alt={item.name} fill className="object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <ImageSquareIcon size={48} className="text-placeholder-tea-icon" />
            </div>
          )}
          {/* Handle — поверх фото */}
          <div className="absolute top-3 left-0 right-0 flex justify-center">
            <span className="w-10 h-1 rounded-[2px] bg-white/60" />
          </div>
          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-4 w-6 h-6 rounded-full bg-overlay-dialog flex items-center justify-center"
          >
            <XIcon size={11} className="text-text-light" weight="bold" />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 pt-4 pb-2 flex flex-col gap-4">

          {/* Title + more */}
          <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-[20px] leading-[24px] font-semibold text-foreground">
                {item.name}
              </h2>
              <div ref={menuRef} className="relative shrink-0 -mt-1">
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-label="Действия"
                  className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:bg-surface-sunken transition-colors"
                >
                  <DotsThreeIcon size={20} weight="bold" />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-9 z-10 bg-popover rounded-lg shadow-lg overflow-hidden min-w-[160px]">
                    <button
                      type="button"
                      className="w-full text-left px-4 py-3 text-[14px] text-destructive hover:bg-surface-sunken transition-colors"
                      onClick={() => { setMenuOpen(false); setConfirmDelete(true); }}
                    >
                      Удалить
                    </button>
                  </div>
                )}
              </div>
            </div>
            {item.type && (
              <p className="text-[14px] leading-[20px] text-muted-foreground">{item.type}</p>
            )}
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map((t) => (
                <span
                  key={t}
                  className="border border-badge-tag-border bg-badge-tag-bg rounded-full px-2 py-0.5 text-[12px] font-semibold leading-[16px] text-badge-tag-text"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
          </div>

          {/* Заметка по посуде (макет 116:5503) */}
          {item.notes && item.notes.trim() && (
            <div className="flex flex-col gap-2 w-full">
              <div className="h-px bg-border-default" />
              <NotesSection text={item.notes} limit={87} />
              <div className="h-px bg-border-default" />
            </div>
          )}

          <div className="flex items-center gap-2">
            <h3 className="text-[16px] font-medium text-foreground">Дегустации</h3>
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
                    className="bg-surface-sunken rounded-2xl pl-2 pr-4 py-2 flex items-center gap-3"
                  >
                    <div className="w-[50px] h-[50px] shrink-0 rounded-lg overflow-hidden bg-placeholder-tea-bg border border-border-strong relative flex items-center justify-center">
                      {t.cover_url ? (
                        <Image src={t.cover_url} alt={t.name} fill className="object-cover" />
                      ) : (
                        <LeafIcon size={18} className="text-placeholder-tea-icon" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col gap-2">
                      <p className="text-[12px] leading-[16px] font-medium text-muted-foreground">
                        {formatTastingDatetime(t.created_at, tzOffset)}
                      </p>
                      <p className="text-[14px] leading-[20px] font-semibold text-foreground truncate">
                        {t.name}
                      </p>
                    </div>
                    <CaretRightIcon size={24} className="text-muted-foreground shrink-0" />
                  </Link>
                ))}
              </div>

              {totalPages > 1 && (
                <PaginationButtons
                  current={page}
                  total={totalPages}
                  onPageChange={(p) => setPage(() => p)}
                />
              )}
            </>
          ) : (
            <div className="border border-border-default rounded-2xl py-4 flex flex-col items-center gap-4">
              <span className="w-14 h-14 rounded-full bg-placeholder-tea-bg flex items-center justify-center">
                <BowlSteamIcon size={24} className="text-muted-foreground" />
              </span>
              <div className="flex flex-col gap-2 text-center px-4">
                <p className="text-[18px] leading-[24px] font-semibold text-text-secondary">Дегустаций нет</p>
                <p className="text-[14px] leading-[20px] text-muted-foreground">
                  Создайте новую дегустацию с этой посудой.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        </div>

        <div className="flex gap-2 p-4 border-t border-border-default bg-card shrink-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="h-11 w-11 shrink-0 rounded-full border border-border-strong bg-surface-muted text-text-secondary shadow-xs flex items-center justify-center transition-colors hover:bg-surface-sunken active:bg-surface-sunken-strong outline-none focus-visible:ring-[3px] focus-visible:ring-ring-focus"
          >
            <XIcon size={16} weight="bold" />
          </button>
          <AppButton
            type="button"
            variant="secondary"
            onClick={() => {
              if (item) router.push(`/quick?teaware_id=${item.id}`);
            }}
            className="flex-1"
          >
            Быстрая заметка
          </AppButton>
          <AppButton
            type="button"
            onClick={() => {
              if (item) router.push(`/new?teaware_id=${item.id}`);
            }}
            className="flex-1"
          >
            Дегустация
          </AppButton>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={confirmDelete}
        title={`Удалить «${item.name}»?`}
        description={
          total > 0
            ? `Связанные дегустации (${total}) останутся, но потеряют привязку к посуде.`
            : 'Действие нельзя отменить.'
        }
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
