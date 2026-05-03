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
            className={`flex items-center gap-3 px-3 py-3 rounded-lg border text-left shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] transition-colors ${
              active ? 'bg-white border-[#b45309]' : 'bg-white border-[#e5e5e5]'
            }`}
          >
            <span className={`flex-1 text-[14px] leading-5 ${active ? 'text-[#1c1917]' : 'text-[#404040]'}`}>
              {opt}
            </span>
            <span className="relative shrink-0 size-4">
              <span
                className={`absolute left-px top-px w-[14px] h-[14px] rounded-full border flex items-center justify-center shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] transition-colors ${
                  active ? 'border-[#b45309]' : 'border-[#d4d4d4]'
                }`}
              >
                {active && <span className="w-2 h-2 rounded-full bg-[#b45309]" />}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
