'use client';

import { useTheme } from 'next-themes';
import { SunIcon, MoonIcon, CircleHalfIcon, XIcon } from '@phosphor-icons/react';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

const OPTIONS = [
  { value: 'light', label: 'Всегда светлая', Icon: SunIcon },
  { value: 'dark', label: 'Всегда темная', Icon: MoonIcon },
  { value: 'system', label: 'Как на устройстве', Icon: CircleHalfIcon },
] as const;

export default function ThemeSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { theme, setTheme } = useTheme();

  useBodyScrollLock(open);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-overlay-scrim backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 -translate-x-1/2 bottom-0 w-full max-w-2xl z-[70] bg-card rounded-t-3xl flex flex-col max-h-[85dvh] overflow-hidden">
        <div className="flex justify-center pt-2 pb-1">
          <span className="w-9 h-1 rounded-full bg-border-strong" />
        </div>

        <div className="flex items-end justify-between px-4 pt-2 pb-4">
          <h2 className="text-[20px] font-semibold text-foreground">Настройки темы</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 rounded-full bg-overlay-dialog flex items-center justify-center shrink-0"
          >
            <XIcon size={11} className="text-text-light" weight="bold" />
          </button>
        </div>

        <div className="px-4 pb-8 flex flex-col gap-2">
          {OPTIONS.map((opt) => {
            const active = theme === opt.value;
            const Icon = opt.Icon;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { setTheme(opt.value); onClose(); }}
                aria-pressed={active}
                className={`flex items-center gap-3 px-4 h-12 rounded-xl border bg-surface-input shadow-xs transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring-focus ${
                  active ? 'border-accent-default' : 'border-border-input'
                }`}
              >
                <Icon size={22} className={active ? 'text-accent-default' : 'text-text-secondary'} />
                <span className={`text-[15px] font-medium ${active ? 'text-foreground' : 'text-text-secondary'}`}>
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
