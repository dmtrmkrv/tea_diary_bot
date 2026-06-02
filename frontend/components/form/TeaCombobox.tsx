'use client';

import { useEffect, useState } from 'react';
import { CaretDownIcon, MagnifyingGlassIcon } from '@phosphor-icons/react';
import AddTeaSheet from '@/components/collection/AddTeaSheet';
import TeaPickerSheet from '@/components/form/TeaPickerSheet';
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
  const [items, setItems] = useState<TeaItem[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [addSheetOpen, setAddSheetOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getTeaCollection(100, 0)
      .then(res => { if (!cancelled) setItems(res.items); })
      .catch(() => { if (!cancelled) setItems([]); });
    return () => { cancelled = true; };
  }, []);

  function handleSaved(created: TeaItem) {
    setItems(prev => [created, ...prev.filter(i => i.id !== created.id)]);
    onChange(created);
    setAddSheetOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="w-full h-10 px-2 rounded-lg border border-[#e5e5e5] bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] flex items-center gap-2 text-left"
      >
        {value ? (
          <span className="flex-1 text-[14px] text-[#0a0a0a] truncate">{value.name}</span>
        ) : (
          <>
            <MagnifyingGlassIcon size={16} className="text-[#a8a29e] shrink-0" />
            <span className="flex-1 text-[14px] text-[#737373] truncate">{placeholder}</span>
          </>
        )}
        <CaretDownIcon size={16} className="text-[#a8a29e] shrink-0" />
      </button>

      <TeaPickerSheet
        open={pickerOpen}
        items={items}
        initialValue={value}
        onSelect={item => { onChange(item); setPickerOpen(false); }}
        onAddNew={() => { setPickerOpen(false); setAddSheetOpen(true); }}
        onClose={() => setPickerOpen(false)}
      />

      <AddTeaSheet
        open={addSheetOpen}
        onClose={() => setAddSheetOpen(false)}
        onSaved={handleSaved}
      />
    </>
  );
}
