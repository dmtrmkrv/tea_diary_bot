'use client';

export default function RatingPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="grid grid-cols-10 gap-1">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
        const active = value === n;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(active ? 0 : n)}
            className={`h-8 rounded-md border text-[14px] font-medium transition-colors ${
              active
                ? 'bg-[#b45309] text-white border-[#b45309]'
                : 'bg-white text-[#1c1917] border-[#d4d4d4]'
            }`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
