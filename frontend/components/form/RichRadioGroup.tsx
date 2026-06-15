'use client';

export default function RichRadioGroup({
  options,
  value,
  onChange,
  cols = 2,
}: {
  options: string[];
  value: string | null;
  onChange: (next: string | null) => void;
  cols?: 2 | 3;
}) {
  const gridCols = cols === 3 ? 'grid-cols-3' : 'grid-cols-2';
  return (
    <div className={`grid gap-2 ${gridCols}`}>
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(active ? null : opt)}
            className={`flex items-center gap-3 px-3 py-3 rounded-lg border bg-surface-input text-left shadow-xs transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring-focus ${
              active ? 'border-accent-default' : 'border-border-input'
            }`}
          >
            <span className={`flex-1 text-[14px] leading-5 ${active ? 'text-foreground' : 'text-text-secondary'}`}>
              {opt}
            </span>
            <span className="relative shrink-0 size-4">
              <span
                className={`absolute left-px top-px w-[14px] h-[14px] rounded-full border flex items-center justify-center shadow-xs transition-colors ${
                  active ? 'border-accent-default' : 'border-border-input'
                }`}
              >
                {active && <span className="w-2 h-2 rounded-full bg-accent-default" />}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
