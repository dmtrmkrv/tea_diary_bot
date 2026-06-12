'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MagnifyingGlassIcon, XIcon, CaretDownIcon } from '@phosphor-icons/react';
import FilterSheet, { type FilterOption } from '@/components/FilterSheet';

const CATEGORY_OPTIONS: FilterOption[] = [
  'Белый', 'Жёлтый', 'Зелёный', 'Красный', 'Улун', 'Шу пуэр', 'Шен пуэр', 'Хэй ча', 'Другое',
].map((c) => ({ value: c, label: c }));

const RATING_OPTIONS: FilterOption[] = [
  { value: '7', label: '7+' },
  { value: '8', label: '8+' },
  { value: '9', label: '9+' },
];

export type TeawareFilterItem = { id: number; name: string; cover_url: string | null };

/**
 * Инлайн-режим поиска на главной: заголовок + лупа/крестик, при открытии —
 * строка поиска (живой, debounce 400мс) и чипы-входы фильтров.
 * Состояние живёт в URL (?q=&cat=&tw=&rating=) — серверная главная
 * перечитывает список, пагинация и back работают.
 */
export default function SearchControls({ teaware }: { teaware: TeawareFilterItem[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlQ = searchParams.get('q') ?? '';
  const cats = (searchParams.get('cat') ?? '').split(',').filter(Boolean);
  const tws = (searchParams.get('tw') ?? '').split(',').filter(Boolean);
  const rating = (searchParams.get('rating') ?? '').split(',').filter(Boolean);

  const hasAnyFilter = Boolean(urlQ || cats.length || tws.length || rating.length);
  const [open, setOpen] = useState(hasAnyFilter);
  const [q, setQ] = useState(urlQ);
  const [sheet, setSheet] = useState<'cat' | 'tw' | 'rating' | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function buildUrl(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete('page'); // смена запроса/фильтра сбрасывает пагинацию
    const qs = params.toString();
    return qs ? `/?${qs}` : '/';
  }

  // Живой текстовый поиск с debounce
  useEffect(() => {
    if (q === urlQ) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      router.replace(buildUrl({ q }), { scroll: false });
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function toggleOpen() {
    if (open) {
      // Закрыть = сбросить весь поиск
      setQ('');
      setOpen(false);
      router.replace('/', { scroll: false });
    } else {
      setOpen(true);
    }
  }

  function applyFilter(key: 'cat' | 'tw' | 'rating', values: string[]) {
    router.replace(buildUrl({ [key]: values.join(',') }), { scroll: false });
  }

  const teawareNames = new Map(teaware.map((t) => [String(t.id), t.name]));

  function chipLabel(base: string, values: string[], single?: boolean): string {
    if (values.length === 0) return base;
    if (base === 'Посуда' && values.length === 1) {
      return teawareNames.get(values[0]) ?? base;
    }
    if (single) return `${base} ${values[0]}+`;
    return `${base} · ${values.length}`;
  }

  return (
    <>
      <div className="flex items-center justify-between pt-12">
        <h1 className="text-[32px] font-semibold leading-[32px] tracking-[-1px] text-foreground">
          Мои дегустации
        </h1>
        <button
          type="button"
          onClick={toggleOpen}
          aria-label={open ? 'Закрыть поиск' : 'Поиск'}
          className="flex items-center justify-center w-9 h-9 bg-button-icon-bg border border-button-icon-border rounded-lg text-foreground"
        >
          {open ? <XIcon size={16} /> : <MagnifyingGlassIcon size={16} />}
        </button>
      </div>

      {open && (
        <div className="flex flex-col gap-3 mt-4">
          <div className="flex items-center gap-2 h-11 px-2 rounded-lg border border-border-input bg-surface-input shadow-xs transition-colors focus-within:border-accent-default focus-within:ring-[3px] focus-within:ring-ring-focus">
            <MagnifyingGlassIcon size={16} className="text-text-placeholder shrink-0" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Поиск по названию или сорту"
              className="flex-1 outline-none text-[14px] text-foreground bg-transparent placeholder:text-text-placeholder"
            />
            {q && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setQ('')}
                aria-label="Очистить"
                className="w-5 h-5 shrink-0 rounded-full bg-surface-sunken-strong text-text-secondary flex items-center justify-center"
              >
                <XIcon size={11} weight="bold" />
              </button>
            )}
          </div>

          <div className="flex gap-2 overflow-x-auto overscroll-x-contain no-scrollbar -mx-4 px-4">
            <FilterChip
              label={chipLabel('Категория', cats)}
              active={cats.length > 0}
              onClick={() => setSheet('cat')}
            />
            {teaware.length > 0 && (
              <FilterChip
                label={chipLabel('Посуда', tws)}
                active={tws.length > 0}
                onClick={() => setSheet('tw')}
              />
            )}
            <FilterChip
              label={chipLabel('Рейтинг', rating, true)}
              active={rating.length > 0}
              onClick={() => setSheet('rating')}
            />
          </div>
        </div>
      )}

      <FilterSheet
        open={sheet === 'cat'}
        title="Категория"
        options={CATEGORY_OPTIONS}
        multi
        selected={cats}
        onApply={(v) => applyFilter('cat', v)}
        onClose={() => setSheet(null)}
      />
      <FilterSheet
        open={sheet === 'tw'}
        title="Посуда"
        options={teaware.map((t) => ({ value: String(t.id), label: t.name, image: t.cover_url }))}
        multi
        selected={tws}
        onApply={(v) => applyFilter('tw', v)}
        onClose={() => setSheet(null)}
      />
      <FilterSheet
        open={sheet === 'rating'}
        title="Рейтинг"
        options={RATING_OPTIONS}
        multi={false}
        selected={rating}
        onApply={(v) => applyFilter('rating', v)}
        onClose={() => setSheet(null)}
      />
    </>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 h-9 pl-3 pr-2 rounded-lg border text-[14px] font-medium transition-colors flex items-center gap-1 ${
        active
          ? 'bg-button-toggle-bg border-accent-default text-foreground'
          : 'bg-surface-input border-border-input text-text-secondary'
      }`}
    >
      {label}
      <CaretDownIcon size={14} className={active ? 'text-foreground' : 'text-text-placeholder'} />
    </button>
  );
}
