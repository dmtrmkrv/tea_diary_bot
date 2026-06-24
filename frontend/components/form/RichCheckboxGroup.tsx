'use client';

import { Textarea } from '@/components/ui/textarea';

export type RichCheckboxState = {
  selected: string[];
  other: string;
  otherEnabled: boolean;
};

export const emptyRichCheckboxState: RichCheckboxState = {
  selected: [],
  other: '',
  otherEnabled: false,
};

export function richCheckboxToCsv(s: RichCheckboxState): string {
  const parts = [...s.selected];
  if (s.otherEnabled && s.other.trim()) {
    parts.push(`Другое: ${s.other.trim()}`);
  }
  return parts.join(', ');
}

// Обратное преобразование (для предзаполнения формы при редактировании).
// Конвенция: «Другое: …» — всегда последний элемент, его запятые относятся к
// свободному тексту, а не разделяют пункты (та же логика, что на детальной).
export function csvToRichCheckboxState(csv: string | null | undefined): RichCheckboxState {
  if (!csv || !csv.trim()) return { selected: [], other: '', otherEnabled: false };
  const parts = csv.split(',').map((s) => s.trim()).filter(Boolean);
  const otherIdx = parts.findIndex((p) => p.startsWith('Другое:'));
  if (otherIdx === -1) return { selected: parts, other: '', otherEnabled: false };
  const selected = parts.slice(0, otherIdx);
  const other = parts.slice(otherIdx).join(', ').replace(/^Другое:\s*/, '');
  return { selected, other, otherEnabled: true };
}

function CheckboxIndicator({ active }: { active: boolean }) {
  return (
    <span className="relative shrink-0 size-4">
      <span
        className={`absolute left-px top-px w-[14px] h-[14px] rounded-[4px] border flex items-center justify-center shadow-xs transition-colors ${
          active
            ? 'bg-accent-default border-accent-default text-primary-foreground'
            : 'bg-surface-input border-border-input'
        }`}
      >
        {active && (
          <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
            <path
              d="M1 3.5L3.2 5.5L8 1"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
    </span>
  );
}

export default function RichCheckboxGroup({
  options,
  value,
  onChange,
  hasOther = true,
  otherPlaceholder = 'Другое',
}: {
  options: string[];
  value: RichCheckboxState;
  onChange: (next: RichCheckboxState) => void;
  hasOther?: boolean;
  otherPlaceholder?: string;
}) {
  function toggle(opt: string) {
    const exists = value.selected.includes(opt);
    onChange({
      ...value,
      selected: exists
        ? value.selected.filter((o) => o !== opt)
        : [...value.selected, opt],
    });
  }

  function toggleOther() {
    onChange({ ...value, otherEnabled: !value.otherEnabled });
  }

  function setOtherText(t: string) {
    onChange({ ...value, other: t });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => {
          const active = value.selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={`flex items-center gap-3 px-3 py-3 rounded-lg border bg-surface-input text-left shadow-xs transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring-focus ${
                active ? 'border-accent-default' : 'border-border-input'
              }`}
            >
              <span className={`flex-1 text-[14px] leading-5 ${active ? 'text-foreground' : 'text-text-secondary'}`}>
                {opt}
              </span>
              <CheckboxIndicator active={active} />
            </button>
          );
        })}
      </div>

      {hasOther && (
        <>
          <button
            type="button"
            onClick={toggleOther}
            className={`flex items-center gap-3 px-3 py-3 rounded-lg border bg-surface-input text-left shadow-xs transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring-focus ${
              value.otherEnabled ? 'border-accent-default' : 'border-border-input'
            }`}
          >
            <span className={`flex-1 text-[14px] leading-5 ${value.otherEnabled ? 'text-foreground' : 'text-text-secondary'}`}>
              Другое
            </span>
            <CheckboxIndicator active={value.otherEnabled} />
          </button>
          {value.otherEnabled && (
            <Textarea
              value={value.other}
              onChange={(e) => setOtherText(e.target.value)}
              placeholder={otherPlaceholder}
              className="min-h-20"
            />
          )}
        </>
      )}
    </div>
  );
}
