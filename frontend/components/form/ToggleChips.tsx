'use client';

/**
 * Горизонтальная полоса toggle-chips (multi-select).
 * Используется в форме посуды («Подходит для чая»).
 *
 * Active: бордер accent + заливка button-toggle-bg (amber @ 20%).
 * Полоса скроллится горизонтально, chips не сжимаются (shrink-0).
 * Отрицательные маргины (-mx-4 px-4) дают edge-to-edge скролл внутри
 * шторки с px-4 паддингом — обрезка chips на краю экрана, как на макете.
 */
export default function ToggleChips({
  options,
  value,
  onChange,
  leading,
}: {
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  // Кастомные чипы перед опциями в том же скролл-ряду (напр. «Избранное»)
  leading?: React.ReactNode;
}) {
  function toggle(opt: string) {
    onChange(
      value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]
    );
  }

  return (
    <div className="flex gap-2 overflow-x-auto overscroll-x-contain no-scrollbar -mx-4 px-4 pb-1">
      {leading}
      {options.map((opt) => {
        const active = value.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            aria-pressed={active}
            className={`shrink-0 h-9 px-3 rounded-lg border text-[14px] font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring-focus ${
              active
                ? 'bg-button-toggle-bg border-accent-default text-foreground'
                : 'bg-surface-input border-border-input text-text-secondary'
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
