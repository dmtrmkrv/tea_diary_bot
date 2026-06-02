'use client';

import { useState } from 'react';
import Image from 'next/image';
import { LeafIcon, CaretRightIcon } from '@phosphor-icons/react';
import TeaDetailSheet from './TeaDetailSheet';
import type { TeaItem } from '@/lib/apiClient';

export default function TeaItemTrigger({ item }: { item: TeaItem }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="col-span-2 border-b border-[#e7e5e4] pb-2 flex items-center justify-between w-full"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 shrink-0 rounded-lg overflow-hidden bg-[#f5f5f4] relative border border-black/10">
            {item.cover_url
              ? <Image src={item.cover_url} alt={item.name} fill className="object-cover" />
              : <span className="absolute inset-0 flex items-center justify-center"><LeafIcon size={14} className="text-[#a8a29e]" /></span>
            }
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[14px] text-[#0a0a0a] truncate leading-5">{item.name}</p>
            {(item.category || item.year || item.region) && (
              <p className="text-[11px] text-[#737373] truncate leading-4">
                {[item.category, item.year, item.region].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </div>
        <CaretRightIcon size={24} className="text-[#a8a29e] shrink-0" />
      </button>

      {open && <TeaDetailSheet item={item} onClose={() => setOpen(false)} />}
    </>
  );
}
