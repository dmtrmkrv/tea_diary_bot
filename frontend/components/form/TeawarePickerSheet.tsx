'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { MagnifyingGlassIcon, PlusIcon, XIcon, CoffeeIcon } from '@phosphor-icons/react';
import { type Teaware } from '@/lib/apiClient';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

export default function TeawarePickerSheet({
  open,
  items,
  initialValue,
  onSelect,
  onAddNew,
  onClose,
}: {
  open: boolean;
  items: Teaware[];
  initialValue: Teaware | null;
  onSelect: (item: Teaware) => void;
  onAddNew: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Teaware | null>(initialValue);

  useEffect(() => {
    if (open) {
      setSelected(initialValue);
      setQuery('');
    }
  }, [open, initialValue]);

  useBodyScrollLock(open);

  if (!open) return null;

  const isEmpty = items.length === 0;
  const filtered = query.trim()
    ? items.filter(i => i.name.toLowerCase().includes(query.trim().toLowerCase()))
    : items;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-overlay-scrim backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 -translate-x-1/2 bottom-0 w-full max-w-2xl z-[70] bg-card rounded-t-[24px] flex flex-col h-[609px] max-h-[85dvh]">

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <span className="w-10 h-1 rounded-[2px] bg-border-strong" />
        </div>

        {/* Header */}
        <div className="flex items-end justify-between px-4 pt-4 pb-4 shrink-0">
          <h2 className="text-[20px] font-semibold leading-6 text-foreground">Выбор посуды</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 rounded-full bg-overlay-dialog flex items-center justify-center shrink-0"
          >
            <XIcon size={11} className="text-text-light" weight="bold" />
          </button>
        </div>

        {/* Divider */}
        <div className="h-px bg-border-default shrink-0" />

        {/* Search */}
        <div className="px-4 py-3 shrink-0">
          <div className="flex items-center gap-2 h-10 px-2 rounded-lg border border-border-input bg-surface-input shadow-xs transition-colors focus-within:border-accent-default focus-within:ring-[3px] focus-within:ring-ring-focus">
            <MagnifyingGlassIcon size={16} className="text-text-placeholder shrink-0" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Поиск по коллекции"
              className="flex-1 outline-none text-[14px] text-foreground bg-transparent placeholder:text-text-placeholder"
            />
          </div>
        </div>

        {/* List */}
        <div className="mx-4 flex-1 min-h-0 border border-border-strong rounded-lg p-2 overflow-y-auto overscroll-contain">
          {isEmpty ? (
            <EmptyCollection />
          ) : filtered.length === 0 ? (
            <div className="px-2 py-2 text-[14px] text-foreground">Ничего не найдено</div>
          ) : (
            <>
              <div className="px-2 pt-1 pb-2">
                <p className="text-[12px] font-medium text-muted-foreground">Посуда в коллекции</p>
              </div>
              {filtered.map(item => {
                const isSelected = selected?.id === item.id;
                const meta = [
                  item.type,
                  item.volume_ml != null ? `${item.volume_ml} мл` : null,
                ].filter(Boolean).join(' • ');
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelected(item)}
                    className={`w-full flex items-center gap-3 px-1 py-[7.5px] rounded-lg transition-colors ${
                      isSelected ? 'border border-accent-default' : 'border border-transparent'
                    }`}
                  >
                    <div className="w-8 h-8 shrink-0 rounded-lg overflow-hidden bg-placeholder-tea-bg relative flex items-center justify-center border border-placeholder-tea-border">
                      {item.cover_url ? (
                        <Image src={item.cover_url} alt={item.name} fill className="object-cover" />
                      ) : (
                        <CoffeeIcon size={14} className="text-placeholder-tea-icon" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="text-[14px] text-foreground truncate leading-5">{item.name}</p>
                      {meta && (
                        <p className="text-[11px] text-muted-foreground truncate leading-4">{meta}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </>
          )}
        </div>

        {/* Add new */}
        <div className="px-4 pt-3 pb-3 shrink-0">
          <button
            type="button"
            onClick={onAddNew}
            className="w-full h-10 rounded-full bg-button-icon-bg border border-button-icon-border flex items-center justify-center gap-2 text-[14px] font-medium text-foreground shadow-xs"
          >
            <PlusIcon size={16} />
            Добавить новую посуду
          </button>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-4 pb-8 pt-1 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-[122px] h-12 rounded-full bg-surface-sunken text-[16px] font-medium text-muted-foreground shrink-0"
          >
            Отменить
          </button>
          <button
            type="button"
            onClick={() => { if (selected) onSelect(selected); }}
            disabled={!selected}
            className="flex-1 h-12 rounded-full bg-primary text-[16px] font-medium text-primary-foreground disabled:opacity-50"
          >
            Выбрать
          </button>
        </div>
      </div>
    </>
  );
}

function EmptyCollection() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 py-4">
      <div className="w-[90px] h-[90px] rounded-full bg-placeholder-tea-bg flex items-center justify-center">
        <CoffeeIcon size={40} className="text-placeholder-tea-icon" />
      </div>
      <div className="text-center px-4">
        <p className="text-[20px] font-semibold text-text-secondary leading-6 mb-3">Коллекция пустая</p>
        <p className="text-[14px] text-muted-foreground leading-5">
          Добавь посуду,{'\n'}чтобы привязать её к дегустации
        </p>
      </div>
    </div>
  );
}
