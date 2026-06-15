'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { CoffeeIcon, CaretRightIcon } from '@phosphor-icons/react';
import TeawareItemSheet from './TeawareItemSheet';
import type { Teaware } from '@/lib/apiClient';

/**
 * Кликабельная строка посуды на детальной дегустации (по образцу
 * TeaItemTrigger): миниатюра 32px, название, мета, caret. Клик открывает
 * TeawareItemSheet. После удаления посуды из шторки — router.refresh(),
 * чтобы серверная детальная перечитала данные (строка исчезнет).
 */
export default function TeawareItemTrigger({ item }: { item: Teaware }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const meta = [
    item.type,
    item.volume_ml != null ? `${item.volume_ml} мл` : null,
  ].filter(Boolean).join(' · ');

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
              : <span className="absolute inset-0 flex items-center justify-center"><CoffeeIcon size={14} className="text-placeholder-tea-icon" /></span>
            }
          </div>
          <div className="flex-1 min-w-0 text-left flex flex-col gap-[3px]">
            <p className="text-[14px] text-foreground truncate leading-[20px]">{item.name}</p>
            {meta && (
              <p className="text-[12px] text-muted-foreground truncate leading-[16px]">{meta}</p>
            )}
          </div>
        </div>
        <CaretRightIcon size={24} className="text-muted-foreground shrink-0" />
      </button>

      {open && (
        <TeawareItemSheet
          item={item}
          onClose={() => setOpen(false)}
          onDeleted={() => router.refresh()}
        />
      )}
    </>
  );
}
