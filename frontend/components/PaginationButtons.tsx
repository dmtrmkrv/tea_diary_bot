'use client';

function buildPages(current: number, total: number): (number | 'dots')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | 'dots')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push('dots');
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < total - 1) pages.push('dots');
  pages.push(total);
  return pages;
}

export default function PaginationButtons({
  current,
  total,
  onPageChange,
}: {
  current: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  if (total <= 1) return null;
  const pages = buildPages(current, total);

  return (
    <nav className="flex items-center justify-center gap-1 mt-4">
      <button
        disabled={current <= 1}
        onClick={() => onPageChange(current - 1)}
        className="px-3 h-8 flex items-center text-[14px] font-medium text-text-secondary disabled:text-text-disabled disabled:cursor-default"
      >
        Назад
      </button>

      {pages.map((p, i) => {
        if (p === 'dots') {
          return (
            <span key={`dots-${i}`} className="px-2 text-[14px] text-text-disabled">…</span>
          );
        }
        const active = p === current;
        return (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`min-w-8 h-8 px-2 flex items-center justify-center rounded-md text-[14px] font-medium ${
              active ? 'bg-surface-elevated shadow-xs text-foreground' : 'text-text-secondary hover:bg-surface-sunken'
            }`}
          >
            {p}
          </button>
        );
      })}

      <button
        disabled={current >= total}
        onClick={() => onPageChange(current + 1)}
        className="px-3 h-8 flex items-center text-[14px] font-medium text-text-secondary disabled:text-text-disabled disabled:cursor-default"
      >
        Вперёд
      </button>
    </nav>
  );
}
