import Link from 'next/link';

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

export default function PaginationLinks({
  current,
  total,
  buildHref,
}: {
  current: number;
  total: number;
  buildHref: (page: number) => string;
}) {
  if (total <= 1) return null;
  const pages = buildPages(current, total);

  return (
    <nav className="flex items-center justify-center gap-1 mt-4">
      {current > 1 ? (
        <Link
          href={buildHref(current - 1)}
          className="px-3 h-8 flex items-center text-[14px] font-medium text-[#57534e]"
        >
          Назад
        </Link>
      ) : (
        <span className="px-3 h-8 flex items-center text-[14px] font-medium text-[#a8a29e]">
          Назад
        </span>
      )}

      {pages.map((p, i) => {
        if (p === 'dots') {
          return (
            <span key={`dots-${i}`} className="px-2 text-[14px] text-[#a8a29e]">
              …
            </span>
          );
        }
        const active = p === current;
        return (
          <Link
            key={p}
            href={buildHref(p)}
            className={`min-w-8 h-8 px-2 flex items-center justify-center rounded-md text-[14px] font-medium ${
              active
                ? 'bg-white shadow-sm text-[#0a0a0a]'
                : 'text-[#57534e] hover:bg-white/50'
            }`}
          >
            {p}
          </Link>
        );
      })}

      {current < total ? (
        <Link
          href={buildHref(current + 1)}
          className="px-3 h-8 flex items-center text-[14px] font-medium text-[#57534e]"
        >
          Вперёд
        </Link>
      ) : (
        <span className="px-3 h-8 flex items-center text-[14px] font-medium text-[#a8a29e]">
          Вперёд
        </span>
      )}
    </nav>
  );
}
