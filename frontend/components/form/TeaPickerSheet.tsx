'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { MagnifyingGlassIcon, PlusIcon, XIcon, LeafIcon } from '@phosphor-icons/react';
import { type TeaItem } from '@/lib/apiClient';

export default function TeaPickerSheet({
  open,
  items,
  initialValue,
  onSelect,
  onAddNew,
  onClose,
}: {
  open: boolean;
  items: TeaItem[];
  initialValue: TeaItem | null;
  onSelect: (item: TeaItem) => void;
  onAddNew: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<TeaItem | null>(initialValue);

  useEffect(() => {
    if (open) {
      setSelected(initialValue);
      setQuery('');
    }
  }, [open, initialValue]);

  if (!open) return null;

  const isEmpty = items.length === 0;
  const filtered = query.trim()
    ? items.filter(i => i.name.toLowerCase().includes(query.trim().toLowerCase()))
    : items;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-0 right-0 bottom-0 z-[70] bg-white rounded-t-[24px] flex flex-col h-[609px]">

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <span className="w-10 h-1 rounded-[2px] bg-[#d1ccc7]" />
        </div>

        {/* Header */}
        <div className="flex items-end justify-between px-4 pt-4 pb-4 shrink-0">
          <h2 className="text-[20px] font-semibold leading-6 text-[#0a0a0a]">Выбор чая</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 rounded-full bg-[rgba(0,0,0,0.8)] flex items-center justify-center shrink-0"
          >
            <XIcon size={11} className="text-white" weight="bold" />
          </button>
        </div>

        {/* Divider */}
        <div className="h-px bg-[#e8e5e3] shrink-0" />

        {/* Search */}
        <div className="px-4 py-3 shrink-0">
          <div className="flex items-center gap-2 h-10 px-2 rounded-lg border border-[#e5e5e5] bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
            <MagnifyingGlassIcon size={16} className="text-[#a8a29e] shrink-0" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Поиск по коллекции"
              className="flex-1 outline-none text-[14px] text-[#0a0a0a] bg-transparent placeholder:text-[#737373]"
            />
          </div>
        </div>

        {/* List */}
        <div className="mx-4 flex-1 min-h-0 border border-[#d6d3d1] rounded-lg p-2 overflow-y-auto">
          {isEmpty ? (
            <EmptyCollection />
          ) : filtered.length === 0 ? (
            <div className="px-2 py-2 text-[14px] text-[#1c1917]">Ничего не найдено</div>
          ) : (
            <>
              <div className="px-2 pt-1 pb-2">
                <p className="text-[12px] font-medium text-[#737373]">Сорта в коллекции</p>
              </div>
              {filtered.map(item => {
                const isSelected = selected?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelected(item)}
                    className={`w-full flex items-center gap-3 px-1 py-[7.5px] rounded-lg transition-colors ${
                      isSelected ? 'border border-[#b45309]' : 'border border-transparent'
                    }`}
                  >
                    <div className="w-8 h-8 shrink-0 rounded-lg overflow-hidden bg-[#f5f5f4] relative flex items-center justify-center border border-black/10">
                      {item.cover_url ? (
                        <Image src={item.cover_url} alt={item.name} fill className="object-cover" />
                      ) : (
                        <LeafIcon size={14} className="text-[#a8a29e]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="text-[14px] text-[#0a0a0a] truncate leading-5">{item.name}</p>
                      {(item.category || item.year) && (
                        <p className="text-[11px] text-[#737373] truncate leading-4">
                          {[item.category, item.year].filter(Boolean).join(' • ')}
                        </p>
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
            className="w-full h-10 rounded-full bg-white/40 border border-[#d4d4d4] flex items-center justify-center gap-2 text-[14px] font-medium text-[#0a0a0a] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]"
          >
            <PlusIcon size={16} />
            Добавить новый сорт
          </button>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-4 pb-8 pt-1 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-[122px] h-12 rounded-full bg-[#f5f5f5] text-[16px] font-medium text-[#737373] shrink-0"
          >
            Отменить
          </button>
          <button
            type="button"
            onClick={() => { if (selected) onSelect(selected); }}
            disabled={!selected}
            className="flex-1 h-12 rounded-full bg-[#b45309] text-[16px] font-medium text-white disabled:opacity-50"
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
      <div className="w-[90px] h-[90px] rounded-full bg-[#f5f5f4] flex items-center justify-center">
        <LeafIcon size={40} className="text-[#a8a29e]" />
      </div>
      <div className="text-center px-4">
        <p className="text-[20px] font-semibold text-[#57534e] leading-6 mb-3">Коллекция пустая</p>
        <p className="text-[14px] text-[#78716c] leading-5">
          Добавь первый сорт чая,{'\n'}чтобы добавить его к дегустации
        </p>
      </div>
    </div>
  );
}
