'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { XIcon, CoffeeIcon } from '@phosphor-icons/react';
import { AppButton } from '@/components/ui/app-button';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

export type FilterOption = {
  value: string;
  label: string;
  image?: string | null; // есть image → список со строками, нет → wrap-чипы
};

/**
 * Переиспользуемая шторка фильтра (категории / посуда / рейтинг).
 * Выбор применяется по «Применить», «Сбросить» очищает выбор.
 */
export default function FilterSheet({
  open,
  title,
  options,
  multi,
  selected,
  onApply,
  onClose,
}: {
  open: boolean;
  title: string;
  options: FilterOption[];
  multi: boolean;
  selected: string[];
  onApply: (next: string[]) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<string[]>(selected);

  useEffect(() => {
    if (open) setDraft(selected);
  }, [open, selected]);

  useBodyScrollLock(open);

  if (!open) return null;

  const asList = options.some((o) => o.image !== undefined);

  function toggle(value: string) {
    if (multi) {
      setDraft((d) => (d.includes(value) ? d.filter((v) => v !== value) : [...d, value]));
    } else {
      setDraft((d) => (d.includes(value) ? [] : [value]));
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-overlay-scrim backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 -translate-x-1/2 bottom-0 w-full max-w-2xl z-[70] bg-card rounded-t-3xl flex flex-col max-h-[calc(100svh-48px)] overflow-hidden">
        <div className="flex justify-center pt-2 pb-1">
          <span className="w-9 h-1 rounded-full bg-border-strong" />
        </div>

        <div className="flex items-end justify-between px-4 pt-2 pb-3 shrink-0">
          <h2 className="text-[20px] font-semibold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 rounded-full bg-overlay-dialog flex items-center justify-center shrink-0"
          >
            <XIcon size={11} className="text-text-light" weight="bold" />
          </button>
        </div>

        <div className="h-px bg-border-default shrink-0" />

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4">
          {asList ? (
            <div className="flex flex-col gap-2">
              {options.map((opt) => {
                const active = draft.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggle(opt.value)}
                    aria-pressed={active}
                    className={`flex items-center gap-3 px-2 py-2 rounded-xl border text-left transition-colors ${
                      active ? 'border-accent-default bg-button-toggle-bg' : 'border-border-input bg-surface-input'
                    }`}
                  >
                    <span className="w-8 h-8 shrink-0 rounded-lg overflow-hidden bg-placeholder-tea-bg border border-placeholder-tea-border relative flex items-center justify-center">
                      {opt.image ? (
                        <Image src={opt.image} alt={opt.label} fill className="object-cover" />
                      ) : (
                        <CoffeeIcon size={14} className="text-placeholder-tea-icon" />
                      )}
                    </span>
                    <span className={`flex-1 text-[14px] leading-5 truncate ${active ? 'text-foreground font-medium' : 'text-text-secondary'}`}>
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {options.map((opt) => {
                const active = draft.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggle(opt.value)}
                    aria-pressed={active}
                    className={`h-9 px-3 rounded-lg border text-[14px] font-medium transition-colors ${
                      active
                        ? 'bg-button-toggle-bg border-accent-default text-foreground'
                        : 'bg-surface-input border-border-input text-text-secondary'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex gap-2 p-4 border-t border-border-default bg-card shrink-0">
          <AppButton
            type="button"
            variant="secondary"
            onClick={() => setDraft([])}
            className="w-[120px] shrink-0"
          >
            Сбросить
          </AppButton>
          <AppButton
            type="button"
            onClick={() => { onApply(draft); onClose(); }}
            className="flex-1"
          >
            Применить
          </AppButton>
        </div>
      </div>
    </>
  );
}
