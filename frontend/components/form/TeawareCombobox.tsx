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
        className="w-full h-10 px-2 rounded-lg border border-border-input bg-surface-input shadow-xs flex items-center gap-2 text-left outline-none transition-colors focus-visible:border-accent-default focus-visible:ring-[3px] focus-visible:ring-ring-focus"
      >
        {value ? (
          <span className="flex-1 text-[14px] text-foreground truncate">
            {value.name}
          </span>
        ) : (
          <>
            <MagnifyingGlassIcon size={16} className="text-text-placeholder shrink-0" />
            <span className="flex-1 text-[14px] text-text-placeholder truncate">
              Найти или добавить посуду
            </span>
          </>
        )}
        <CaretDownIcon size={16} className="text-text-placeholder shrink-0" />
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[var(--anchor-width)] max-h-[min(360px,calc(100dvh-120px))] overflow-hidden"
        align="start"
        sideOffset={4}
      >
        <div className="px-4 pt-2 pb-1 text-[12px] text-muted-foreground">Посуда</div>
        <div className="px-4 pb-2 border-b border-border-default">
          <div className="flex items-center gap-2 h-8">
            <MagnifyingGlassIcon size={16} className="text-text-placeholder" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Найти или добавить посуду"
              className="flex-1 outline-none text-[14px] text-foreground bg-transparent placeholder:text-text-placeholder"
            />
          </div>
        </div>
        <div className="max-h-[220px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-[14px] text-foreground">
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
                className="w-full flex items-center gap-2 px-4 py-2 hover:bg-accent text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-foreground truncate">
                    {item.name}
                  </p>
                  {(item.type || item.volume_ml != null) && (
                    <p className="text-[12px] text-muted-foreground truncate">
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
          className="w-full flex items-center justify-center gap-2 h-12 border-t border-border-default text-[14px] font-medium text-foreground"
        >
          <PlusIcon size={16} />
          Добавить посуду
        </button>
      </PopoverContent>
    </Popover>
  );
}
