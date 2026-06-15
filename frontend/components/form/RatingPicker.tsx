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
            className={`h-8 rounded-md border text-[14px] font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring-focus ${
              active
                ? 'bg-primary text-primary-foreground border-accent-default'
                : 'bg-surface-input text-foreground border-border-input'
            }`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
