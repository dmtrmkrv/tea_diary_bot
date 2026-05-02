'use client';

import Image from 'next/image';
import { LeafIcon } from '@phosphor-icons/react';
import CategoryBadge from '@/components/CategoryBadge';
import type { TeaItem } from '@/lib/apiClient';

function pluralizeTastings(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} дегустация`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} дегустации`;
  return `${n} дегустаций`;
}

export default function TeaCard({ item, onClick }: { item: TeaItem; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full bg-white rounded-2xl shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)] p-2 flex gap-3 items-center text-left"
    >
      <div className="w-[76px] h-[76px] shrink-0 rounded-xl overflow-hidden bg-[#f5f5f4] relative flex items-center justify-center">
        {item.cover_url ? (
          <Image src={item.cover_url} alt={item.name} fill className="object-cover" />
        ) : (
          <LeafIcon size={32} className="text-[#a8a29e]" />
        )}
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <p className="text-[14px] leading-[20px] font-semibold text-[#1c1917] truncate">
          {item.name}
        </p>
        <div className="flex flex-wrap gap-1">
          {item.category && <CategoryBadge category={item.category} />}
          {item.year != null && (
            <span className="border border-[#d4d4d4] bg-white/50 rounded-full px-2 py-0.5 text-[12px] font-semibold leading-[16px] text-[#0a0a0a]">
              {item.year}
            </span>
          )}
          {item.region && (
            <span className="border border-[#d4d4d4] bg-white/50 rounded-full px-2 py-0.5 text-[12px] font-semibold leading-[16px] text-[#0a0a0a]">
              {item.region}
            </span>
          )}
        </div>
        <p className="text-[12px] leading-[16px] text-[#78716c]">
          {pluralizeTastings(item.tasting_count)}
        </p>
      </div>
    </button>
  );
}
