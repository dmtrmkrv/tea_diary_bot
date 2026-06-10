'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { CoffeeIcon, DotsThreeIcon } from '@phosphor-icons/react';
import type { Teaware } from '@/lib/apiClient';

function pluralizeTastings(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} дегустация`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} дегустации`;
  return `${n} дегустаций`;
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="border border-badge-tag-border bg-badge-tag-bg rounded-full px-2 py-0.5 text-[12px] font-semibold leading-[16px] text-badge-tag-text">
      {children}
    </span>
  );
}

export default function TeawareCard({
  item,
  onClick,
  onDelete,
}: {
  item: Teaware;
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

  const tags = [item.region, item.material, item.volume_ml != null ? `${item.volume_ml} мл` : null]
    .filter(Boolean) as string[];

  return (
    <div className="w-full bg-card rounded-2xl shadow-sm p-2 flex gap-3 items-center text-left relative">
      {/* Клик по карточке — открыть просмотр; кнопка more поверх */}
      <button
        type="button"
        onClick={onClick}
        className="absolute inset-0 rounded-2xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring-focus"
        aria-label={item.name}
      />

      <div className="w-[76px] h-[76px] shrink-0 rounded-xl overflow-hidden bg-placeholder-tea-bg border border-placeholder-tea-border relative flex items-center justify-center pointer-events-none">
        {item.cover_url ? (
          <Image src={item.cover_url} alt={item.name} fill className="object-cover" />
        ) : (
          <CoffeeIcon size={32} className="text-placeholder-tea-icon" />
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-1 pointer-events-none">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[14px] leading-[20px] font-semibold text-foreground truncate">
            {item.name}
          </p>
          {item.type && (
            <span className="text-[12px] leading-[16px] text-muted-foreground shrink-0">
              {item.type}
            </span>
          )}
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map((t) => <Tag key={t}>{t}</Tag>)}
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12px] leading-[16px] text-muted-foreground">
            {pluralizeTastings(item.tasting_count)}
          </p>
        </div>
      </div>

      {/* More (…) — поверх оверлей-кнопки карточки */}
      <div ref={menuRef} className="absolute bottom-2 right-3 z-10">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Действия"
          className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:bg-surface-sunken transition-colors"
        >
          <DotsThreeIcon size={20} weight="bold" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 bottom-9 bg-popover rounded-lg shadow-lg overflow-hidden min-w-[160px]">
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
  );
}
