'use client';

import { useEffect, useState } from 'react';
import { CaretDownIcon, MagnifyingGlassIcon, PlusIcon } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getTeawareCollection, type Teaware } from '@/lib/apiClient';

export default function TeawareCombobox({
  value,
  onChange,
}: {
  value: Teaware | null;
  onChange: (item: Teaware | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Teaware[]>([]);

  useEffect(() => {
    let cancelled = false;
    getTeawareCollection(100, 0)
      .then((res) => { if (!cancelled) setItems(res.items); })
      .catch(() => { if (!cancelled) setItems([]); });
    return () => { cancelled = true; };
  }, []);

  const filtered = query.trim()
    ? items.filter((i) => i.name.toLowerCase().includes(query.trim().toLowerCase()))
    : items;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="w-full h-10 px-2 rounded-lg border border-[#e5e5e5] bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] flex items-center gap-2 text-left"
      >
        {value ? (
          <span className="flex-1 text-[14px] text-[#0a0a0a] truncate">
            {value.name}
          </span>
        ) : (
          <>
            <MagnifyingGlassIcon size={16} className="text-[#a8a29e] shrink-0" />
            <span className="flex-1 text-[14px] text-[#737373] truncate">
              Найти или добавить посуду
            </span>
          </>
        )}
        <CaretDownIcon size={16} className="text-[#a8a29e] shrink-0" />
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[var(--anchor-width)] max-h-[min(360px,calc(100dvh-120px))] overflow-hidden"
        align="start"
        sideOffset={4}
      >
        <div className="px-4 pt-2 pb-1 text-[12px] text-[#a8a29e]">Посуда</div>
        <div className="px-4 pb-2 border-b border-[#e7e5e4]">
          <div className="flex items-center gap-2 h-8">
            <MagnifyingGlassIcon size={16} className="text-[#a8a29e]" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Найти или добавить посуду"
              className="flex-1 outline-none text-[14px] text-[#0a0a0a] bg-transparent"
            />
          </div>
        </div>
        <div className="max-h-[220px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-[14px] text-[#1c1917]">
              Ничего не найдено
            </div>
          ) : (
            filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onChange(item);
                  setOpen(false);
                  setQuery('');
                }}
                className="w-full flex items-center gap-2 px-4 py-2 hover:bg-[#f5f5f4] text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-[#1c1917] truncate">
                    {item.name}
                  </p>
                  {(item.type || item.volume_ml != null) && (
                    <p className="text-[12px] text-[#78716c] truncate">
                      {[item.type, item.volume_ml ? `${item.volume_ml} мл` : null]
                        .filter(Boolean)
                        .join(' • ')}
                    </p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
        <button
          type="button"
          onClick={() => toast('Скоро будет доступно')}
          className="w-full flex items-center justify-center gap-2 h-12 border-t border-[#e7e5e4] text-[14px] font-medium text-[#1c1917]"
        >
          <PlusIcon size={16} />
          Добавить посуду
        </button>
      </PopoverContent>
    </Popover>
  );
}
