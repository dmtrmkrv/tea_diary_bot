'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { LeafIcon, DotsThreeIcon } from '@phosphor-icons/react';
import CategoryBadge from '@/components/CategoryBadge';
import type { TeaItem } from '@/lib/apiClient';

function pluralizeTastings(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} дегустация`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} дегустации`;
  return `${n} дегустаций`;
}

export default function TeaCard({
  item,
  onClick,
  onDelete,
}: {
  item: TeaItem;
  onClick: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    // Отступы/гэпы по макету 123:3037: px-12 pt-12 pb-8, gap-12, items-start
    <div className="w-full bg-card rounded-2xl shadow-xs px-3 pt-3 pb-2 flex gap-3 items-start text-left relative">
      {/* Клик по карточке — открыть просмотр; кнопка more поверх */}
      <button
        type="button"
        onClick={onClick}
        className="absolute inset-0 rounded-2xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring-focus"
        aria-label={item.name}
      />

      <div className="w-[76px] h-[76px] shrink-0 rounded-lg overflow-hidden bg-placeholder-tea-bg border border-border-strong relative flex items-center justify-center pointer-events-none">
        {item.cover_url ? (
          <Image src={item.cover_url} alt={item.name} fill className="object-cover" />
        ) : (
          <LeafIcon size={32} className="text-placeholder-tea-icon" />
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-3 pointer-events-none">
        <div className="flex flex-col gap-2">
          <p className="text-[14px] leading-[20px] font-semibold text-foreground truncate">
            {item.name}
          </p>
          <div className="flex flex-wrap gap-1">
            {item.category && <CategoryBadge category={item.category} />}
            {item.year != null && (
              <span className="border border-badge-tag-border bg-badge-tag-bg rounded-full px-2 py-0.5 text-[12px] font-semibold leading-[16px] text-badge-tag-text">
                {item.year}
              </span>
            )}
            {item.region && (
              <span className="border border-badge-tag-border bg-badge-tag-bg rounded-full px-2 py-0.5 text-[12px] font-semibold leading-[16px] text-badge-tag-text">
                {item.region}
              </span>
            )}
          </div>
        </div>

        {/* Info-строка: мета слева, more (…) справа — в потоке, по макету */}
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12px] leading-[16px] font-medium text-muted-foreground truncate">
            {pluralizeTastings(item.tasting_count)}
            {item.amount_g != null && item.amount_g > 0 && (
              <> • Осталось: {item.amount_g.toLocaleString('ru-RU')} гр</>
            )}
          </p>
          <div ref={menuRef} className="relative shrink-0 pointer-events-auto z-10">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Действия"
              className="w-8 h-8 -my-1.5 -mr-1.5 flex items-center justify-center rounded-full text-muted-foreground hover:bg-surface-sunken transition-colors"
            >
              <DotsThreeIcon size={20} weight="bold" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 bottom-8 bg-popover rounded-lg shadow-lg overflow-hidden min-w-[160px]">
                <button
                  type="button"
                  className="w-full text-left px-4 py-3 text-[14px] text-destructive hover:bg-surface-sunken transition-colors"
                  onClick={() => { setMenuOpen(false); onDelete(); }}
                >
                  Удалить
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
