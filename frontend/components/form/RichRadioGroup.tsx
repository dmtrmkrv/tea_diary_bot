'use client';

export default function RichRadioGroup({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(active ? null : opt)}
            className={`flex items-center justify-between gap-2 h-9 px-3 rounded-full border text-[14px] font-medium transition-colors ${
              active
                ? 'bg-[#b45309] text-white border-[#b45309]'
                : 'bg-white text-[#1c1917] border-[#d4d4d4]'
            }`}
          >
            <span className="truncate">{opt}</span>
            <span
              className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                active ? 'border-white' : 'border-[#d4d4d4]'
              }`}
            >
              {active && <span className="w-2 h-2 rounded-full bg-white" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
