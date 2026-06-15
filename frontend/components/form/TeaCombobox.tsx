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
        className="w-full h-11 px-2 rounded-lg border border-border-input bg-surface-input shadow-xs flex items-center gap-2 text-left outline-none transition-colors focus-visible:border-accent-default focus-visible:ring-[3px] focus-visible:ring-ring-focus"
      >
        {value ? (
          <span className="flex-1 text-[14px] text-foreground truncate">{value.name}</span>
        ) : (
          <>
            <MagnifyingGlassIcon size={16} className="text-text-placeholder shrink-0" />
            <span className="flex-1 text-[14px] text-text-placeholder truncate">{placeholder}</span>
          </>
        )}
        <CaretDownIcon size={16} className="text-text-placeholder shrink-0" />
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
