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
              className={`flex items-center justify-between gap-2 h-9 px-3 rounded-full border text-[14px] font-medium transition-colors ${
                active
                  ? 'bg-[#b45309] text-white border-[#b45309]'
                  : 'bg-white text-[#1c1917] border-[#d4d4d4]'
              }`}
            >
              <span className="truncate">{opt}</span>
              <span
                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                  active ? 'border-white bg-white' : 'border-[#d4d4d4] bg-white'
                }`}
              >
                {active && <span className="w-2 h-2 rounded-sm bg-[#b45309]" />}
              </span>
            </button>
          );
        })}
      </div>

      {hasOther && (
        <>
          <button
            type="button"
            onClick={toggleOther}
            className={`flex items-center justify-between gap-2 h-9 px-3 rounded-full border text-[14px] font-medium ${
              value.otherEnabled
                ? 'bg-[#b45309] text-white border-[#b45309]'
                : 'bg-white text-[#1c1917] border-[#d4d4d4]'
            }`}
          >
            <span>Другое</span>
            <span
              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                value.otherEnabled
                  ? 'border-white bg-white'
                  : 'border-[#d4d4d4] bg-white'
              }`}
            >
              {value.otherEnabled && <span className="w-2 h-2 rounded-sm bg-[#b45309]" />}
            </span>
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
