'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { CaretDownIcon, MagnifyingGlassIcon, PlusIcon, LeafIcon } from '@phosphor-icons/react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import AddTeaSheet from '@/components/collection/AddTeaSheet';
import { getTeaCollection, type TeaItem } from '@/lib/apiClient';

export default function TeaCombobox({
  value,
  onChange,
  placeholder = 'Найти или добавить чай',
}: {
  value: TeaItem | null;
  onChange: (item: TeaItem | null) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<TeaItem[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getTeaCollection(100, 0)
      .then((res) => { if (!cancelled) setItems(res.items); })
      .catch(() => { if (!cancelled) setItems([]); });
    return () => { cancelled = true; };
  }, []);

  const filtered = query.trim()
    ? items.filter((i) =>
        i.name.toLowerCase().includes(query.trim().toLowerCase())
      )
    : items;

  function handleSaved(created: TeaItem) {
    setItems((prev) => [created, ...prev.filter((i) => i.id !== created.id)]);
    onChange(created);
    setSheetOpen(false);
    setOpen(false);
    setQuery('');
  }

  return (
    <>
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
                {placeholder}
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
          <div className="px-4 pt-2 pb-1 text-[12px] text-[#a8a29e]">
            Сорта в коллекции
          </div>
          <div className="px-4 pb-2 border-b border-[#e7e5e4]">
            <div className="flex items-center gap-2 h-8">
              <MagnifyingGlassIcon size={16} className="text-[#a8a29e]" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
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
                  <div className="w-8 h-8 shrink-0 rounded-md overflow-hidden bg-[#f5f5f4] relative flex items-center justify-center">
                    {item.cover_url ? (
                      <Image src={item.cover_url} alt={item.name} fill className="object-cover" />
                    ) : (
                      <LeafIcon size={16} className="text-[#a8a29e]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-[#1c1917] truncate">
                      {item.name}
                    </p>
                    <p className="text-[12px] text-[#78716c] truncate">
                      {[item.category, item.year].filter(Boolean).join(' • ')}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="w-full flex items-center justify-center gap-2 h-12 border-t border-[#e7e5e4] text-[14px] font-medium text-[#1c1917]"
          >
            <PlusIcon size={16} />
            Добавить сорт
          </button>
        </PopoverContent>
      </Popover>

      <AddTeaSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSaved={handleSaved}
        initialName={query}
      />
    </>
  );
}
