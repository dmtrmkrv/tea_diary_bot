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
        className="col-span-2 border-b border-border-default pb-2 flex items-center justify-between w-full"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 shrink-0 rounded-lg overflow-hidden bg-placeholder-tea-bg relative border border-placeholder-tea-border">
            {item.cover_url
              ? <Image src={item.cover_url} alt={item.name} fill className="object-cover" />
              : <span className="absolute inset-0 flex items-center justify-center"><LeafIcon size={14} className="text-placeholder-tea-icon" /></span>
            }
          </div>
          <div className="flex-1 min-w-0 text-left flex flex-col gap-[3px]">
            <p className="text-[14px] text-foreground truncate leading-[20px]">{item.name}</p>
            {(item.category || item.year || item.region) && (
              <p className="text-[12px] text-muted-foreground truncate leading-[16px]">
                {[item.category, item.year, item.region].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </div>
        <CaretRightIcon size={24} className="text-muted-foreground shrink-0" />
      </button>

      {open && <TeaDetailSheet item={item} onClose={() => setOpen(false)} />}
    </>
  );
}
