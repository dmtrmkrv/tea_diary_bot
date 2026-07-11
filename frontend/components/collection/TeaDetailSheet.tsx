'use client';

import { AppButton } from '@/components/ui/app-button';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { XIcon, LeafIcon, BowlSteamIcon, DotsThreeIcon, MinusIcon, PlusIcon, StarIcon, LightningIcon } from '@phosphor-icons/react';
import CategoryBadge from '@/components/CategoryBadge';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import { getTeaItemTastings, getTeaFlavorProfile, deleteTeaItem, updateTeaAmount, getMe, type TeaItem, type TastingShort, type FlavorProfile } from '@/lib/apiClient';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useSheetCoverFade } from '@/hooks/useSheetCoverFade';
import PaginationButtons from '@/components/PaginationButtons';
import FlavorProfileSection from '@/components/collection/FlavorProfileSection';
import { formatTastingDatetime, formatShortDate } from '@/lib/datetime';

const PAGE_SIZE = 4;

type LoadedData = { key: string; items: TastingShort[]; total: number };

const AMOUNT_STEP = 5;

export default function TeaDetailSheet({
  item,
  onClose,
  onDeleted,
  onAmountChanged,
}: {
  item: TeaItem | null;
  onClose: () => void;
  onDeleted?: () => void;
  onAmountChanged?: () => void;
}) {
  const router = useRouter();
  const [pageState, setPageState] = useState<{ itemId: number; page: number }>({
    itemId: 0,
    page: 1,
  });
  const page = item && pageState.itemId === item.id ? pageState.page : 1;

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Вкладки «Обзор / Записи» — сбрасываются при смене сорта (паттерн pageState)
  const [tabState, setTabState] = useState<{ itemId: number; tab: 'overview' | 'records' }>({
    itemId: 0,
    tab: 'overview',
  });
  const tab = item && tabState.itemId === item.id ? tabState.tab : 'overview';

  // Вкусовой профиль (агрегат с бэкенда)
  const [profileState, setProfileState] = useState<{ itemId: number; profile: FlavorProfile } | null>(null);
  const profile = item && profileState?.itemId === item.id ? profileState.profile : null;
  useEffect(() => {
    if (!item) return;
    const itemId = item.id;
    let cancelled = false;
    getTeaFlavorProfile(itemId)
      .then((p) => { if (!cancelled) setProfileState({ itemId, profile: p }); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [item]);
  const menuRef = useRef<HTMLDivElement>(null);
  // Фолбэк затемнения фото при скролле для Safari < 26 (без scroll-driven CSS)
  const sheetScrollRef = useRef<HTMLDivElement>(null);
  const coverRef = useRef<HTMLDivElement>(null);

  // --- Остаток (автосохранение: степпер с debounce, инпут по blur) ---
  const [amountState, setAmountState] = useState<{ itemId: number; value: string }>({
    itemId: 0,
    value: '',
  });
  const amountStr =
    item && amountState.itemId === item.id
      ? amountState.value
      : item?.amount_g != null
        ? String(item.amount_g)
        : '';
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedAmount = useRef<number | null>(null);

  useEffect(() => {
    // При смене сорта сбрасываем базу для отката и отменяем отложенный сейв
    lastSavedAmount.current = item?.amount_g ?? null;
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, [item?.id, item?.amount_g]);

  function setAmountLocal(value: string) {
    if (!item) return;
    setAmountState({ itemId: item.id, value });
  }

  function scheduleAmountSave(next: number | null, immediate = false) {
    if (!item) return;
    const itemId = item.id;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const doSave = async () => {
      try {
        await updateTeaAmount(itemId, next);
        lastSavedAmount.current = next;
        onAmountChanged?.();
      } catch {
        toast.error('Не удалось сохранить остаток. Попробуйте ещё раз.');
        setAmountState({
          itemId,
          value: lastSavedAmount.current != null ? String(lastSavedAmount.current) : '',
        });
      }
    };
    if (immediate) {
      doSave();
    } else {
      saveTimer.current = setTimeout(doSave, 800);
    }
  }

  function stepAmount(delta: number) {
    const current = amountStr === '' ? 0 : Number(amountStr);
    const next = Math.max(0, (Number.isNaN(current) ? 0 : current) + delta);
    setAmountLocal(String(next));
    scheduleAmountSave(next);
  }

  function handleAmountInput(v: string) {
    if (v !== '' && !/^\d+$/.test(v)) return;
    setAmountLocal(v);
  }

  function handleAmountBlur() {
    const next = amountStr === '' ? null : Number(amountStr);
    scheduleAmountSave(next, true);
  }

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

  // Часовой пояс пользователя — чтобы время совпадало с карточкой/списком
  // (тот же формат, что в TastingCard и на детальной).
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

  useBodyScrollLock(item != null);

  useSheetCoverFade(sheetScrollRef, coverRef, !!item);

  if (!item) return null;

  const loading = data?.key !== loadKey;
  const tastings = !loading && data ? data.items : [];
  const total = !loading && data ? data.total : 0;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasTastings = total > 0;
  // Счётчик вкладки: у сорта, открытого не из коллекции (детальная дегустации),
  // tasting_count не заполнен — после загрузки списка берём честный total.
  const recordsCount = loading ? item.tasting_count : total;

  async function handleDelete() {
    if (!item) return;
    setConfirmDelete(false);
    try {
      await deleteTeaItem(item.id);
      toast.success('Чай удалён из коллекции');
      onClose();
      onDeleted?.();
    } catch {
      toast.error('Не удалось удалить чай. Попробуйте ещё раз.');
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-overlay-scrim backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 -translate-x-1/2 bottom-0 w-full max-w-2xl z-[70] bg-card rounded-t-3xl flex flex-col max-h-[calc(100svh-48px)] overflow-hidden">
        {/* Скролл-область: фото — часть контента и уезжает при прокрутке
            (постоянное закрытие — крестик в футере и тап по скриму) */}
        <div ref={sheetScrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col">
        {/* Cover full-bleed — handle и X поверх (по макету 98:2050) */}
        <div ref={coverRef} className="lp-sheet-cover relative aspect-[2/1] shrink-0 rounded-3xl overflow-hidden bg-surface-app flex items-center justify-center">
          {item.cover_url ? (
            <Image src={item.cover_url} alt={item.name} fill className="object-cover" />
          ) : (
            <LeafIcon size={64} className="text-placeholder-tea-icon" />
          )}
          <div className="absolute top-3 left-0 right-0 flex justify-center">
            <span className="w-10 h-1 rounded-[2px] bg-white/60" />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-4 w-6 h-6 rounded-full bg-overlay-dialog flex items-center justify-center"
          >
            <XIcon size={11} className="text-text-light" weight="bold" />
          </button>
        </div>

        <div className="px-4 pt-4 pb-4 flex flex-col gap-4">
          <div className="flex flex-col gap-3">
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
          </div>

          {/* Вкладки «Обзор / Записи» (по макету 429:11054) */}
          <div className="flex items-center bg-surface-sunken rounded-full p-1 w-full">
            <button
              type="button"
              onClick={() => item && setTabState({ itemId: item.id, tab: 'overview' })}
              className={`flex-1 min-h-8 rounded-full px-2.5 text-[14px] leading-[20px] font-medium text-foreground transition-colors ${
                tab === 'overview' ? 'bg-surface-elevated shadow-md' : ''
              }`}
            >
              Обзор
            </button>
            <button
              type="button"
              onClick={() => item && setTabState({ itemId: item.id, tab: 'records' })}
              className={`flex-1 min-h-8 rounded-full px-2.5 text-[14px] leading-[20px] font-medium text-foreground transition-colors flex items-center justify-center gap-2 ${
                tab === 'records' ? 'bg-surface-elevated shadow-md' : ''
              }`}
            >
              Записи
              <span className="bg-surface-sunken-strong rounded-full min-w-4 h-4 px-1 flex items-center justify-center text-[12px] leading-[16px] font-semibold text-foreground">
                {recordsCount}
              </span>
            </button>
          </div>

          {tab === 'overview' && (
          <>
          {/* В наличии — степпер с автосохранением (без кнопок подтверждения) */}
          <div className="flex items-center justify-between">
            <p className="text-[18px] leading-[24px] font-semibold text-foreground">В наличии (гр)</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => stepAmount(-AMOUNT_STEP)}
                aria-label={`Минус ${AMOUNT_STEP} грамм`}
                className="w-8 h-8 shrink-0 rounded-full border border-border-input bg-surface-input flex items-center justify-center text-foreground transition-colors outline-none focus-visible:border-accent-default focus-visible:ring-[3px] focus-visible:ring-ring-focus"
              >
                <MinusIcon size={14} weight="bold" />
              </button>
              <input
                inputMode="numeric"
                value={amountStr}
                onChange={(e) => handleAmountInput(e.target.value)}
                onBlur={handleAmountBlur}
                placeholder="0"
                aria-label="Остаток в граммах"
                className="w-[90px] h-9 text-center text-[14px] rounded-lg border border-border-input bg-surface-input text-foreground shadow-xs transition-colors outline-none placeholder:text-text-placeholder focus-visible:border-accent-default focus-visible:ring-[3px] focus-visible:ring-ring-focus"
              />
              <button
                type="button"
                onClick={() => stepAmount(AMOUNT_STEP)}
                aria-label={`Плюс ${AMOUNT_STEP} грамм`}
                className="w-8 h-8 shrink-0 rounded-full border border-border-input bg-surface-input flex items-center justify-center text-foreground transition-colors outline-none focus-visible:border-accent-default focus-visible:ring-[3px] focus-visible:ring-ring-focus"
              >
                <PlusIcon size={14} weight="bold" />
              </button>
            </div>
          </div>

          <div className="h-px bg-border-input" />

          <FlavorProfileSection profile={profile} loading={profile == null} />

          <div className="h-px bg-border-input" />

          {/* Мета-строки (по макету: последняя запись и дата добавления) */}
          <div className="flex flex-col gap-3 text-[12px] leading-[16px] font-medium text-text-secondary">
            <div className="flex items-start justify-between">
              <p>Последняя запись</p>
              <p>
                {profile?.last_tasting_at
                  ? formatShortDate(profile.last_tasting_at, tzOffset)
                  : 'Записей пока нет'}
              </p>
            </div>
            <div className="flex items-start justify-between">
              <p>Дата добавления</p>
              <p>{formatShortDate(item.created_at || profile?.item_created_at || null, tzOffset)}</p>
            </div>
          </div>
          </>
          )}

          {tab === 'records' && (loading ? (
            <p className="text-[14px] text-muted-foreground">Загрузка…</p>
          ) : hasTastings ? (
            <>
              <div className="flex flex-col divide-y divide-border-default">
                {tastings.map((t) => (
                  <Link
                    key={t.id}
                    href={`/tastings/${t.id}`}
                    onClick={onClose}
                    className="py-2.5 flex items-center gap-3"
                  >
                    <div className="w-[50px] h-[50px] shrink-0 rounded-[10px] overflow-hidden bg-surface-input border border-border-strong relative flex items-center justify-center">
                      {t.cover_url ? (
                        <Image src={t.cover_url} alt={t.name} fill className="object-cover" />
                      ) : (
                        <BowlSteamIcon size={24} className="text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[12px] leading-[16px] font-medium text-muted-foreground truncate">
                          {formatTastingDatetime(t.created_at, tzOffset)}
                        </p>
                        <div className="flex items-center gap-1 shrink-0">
                          {t.entry_mode === 'quick' && (
                            <span className="flex items-center justify-center min-h-[20px] min-w-[20px] px-1 py-0.5 rounded-full border border-badge-rating-border text-badge-quick-text">
                              <LightningIcon size={16} weight="fill" />
                            </span>
                          )}
                          {t.rating > 0 && (
                            <span className="flex items-center gap-1 min-h-[20px] px-2 py-0.5 rounded-full border border-badge-rating-border text-badge-rating-text">
                              <StarIcon size={16} weight="fill" />
                              <span className="text-[12px] font-medium leading-[16px]">{t.rating}</span>
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-[14px] leading-[20px] font-semibold text-foreground truncate">
                        {t.name}
                      </p>
                    </div>
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
            <div className="bg-surface-input border border-border-default rounded-2xl py-4 px-4 flex flex-col items-center gap-4">
              <span className="w-14 h-14 rounded-full bg-placeholder-tea-bg flex items-center justify-center">
                <BowlSteamIcon size={24} className="text-muted-foreground" />
              </span>
              <div className="flex flex-col gap-1 text-center">
                <p className="text-[16px] leading-[24px] font-semibold text-text-secondary">Дегустаций нет</p>
                <p className="text-[12px] leading-[16px] text-muted-foreground">
                  Создайте новую дегустацию с этим сортом.
                </p>
              </div>
            </div>
          ))}
        </div>

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
              if (item) router.push(`/quick?tea_item_id=${item.id}`);
            }}
            className="flex-1"
          >
            Быстрая заметка
          </AppButton>
          <AppButton
            type="button"
            onClick={() => {
              if (item) router.push(`/new?tea_item_id=${item.id}`);
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
            ? `Связанные дегустации (${total}) останутся, но потеряют привязку к сорту.`
            : 'Действие нельзя отменить.'
        }
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
