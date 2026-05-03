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

function CheckboxIndicator({ active }: { active: boolean }) {
  return (
    <span className="relative shrink-0 size-4">
      <span
        className={`absolute left-px top-px w-[14px] h-[14px] rounded-[4px] border flex items-center justify-center shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] transition-colors ${
          active ? 'bg-[#b45309] border-[#b45309]' : 'bg-white border-[#d4d4d4]'
        }`}
      >
        {active && (
          <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
            <path
              d="M1 3.5L3.2 5.5L8 1"
              stroke="white"
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
              className={`flex items-center gap-3 px-3 py-3 rounded-lg border text-left shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] transition-colors ${
                active ? 'bg-white border-[#b45309]' : 'bg-white border-[#e5e5e5]'
              }`}
            >
              <span className={`flex-1 text-[14px] leading-5 ${active ? 'text-[#1c1917]' : 'text-[#404040]'}`}>
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
            className={`flex items-center gap-3 px-3 py-3 rounded-lg border text-left shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] transition-colors ${
              value.otherEnabled ? 'bg-white border-[#b45309]' : 'bg-white border-[#e5e5e5]'
            }`}
          >
            <span className={`flex-1 text-[14px] leading-5 ${value.otherEnabled ? 'text-[#1c1917]' : 'text-[#404040]'}`}>
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
