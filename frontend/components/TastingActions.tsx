'use client';

import { useState, useRef, useEffect } from 'react';
import { DotsThreeOutlineIcon } from '@phosphor-icons/react';

export default function TastingActions({ tastingId }: { tastingId: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="bg-[#f5f5f5] flex items-center justify-center h-9 w-9 rounded-full text-[#78716c]"
        aria-label="Действия"
      >
        <DotsThreeOutlineIcon size={16} weight="fill" />
      </button>
      {open && (
        <div className="absolute right-0 top-10 bg-white rounded-lg shadow-lg z-50 overflow-hidden min-w-[160px]">
          <button
            className="w-full text-left px-4 py-3 text-[14px] text-[#1c1917] hover:bg-[#f5f5f5] transition-colors"
            onClick={() => setOpen(false)}
          >
            Редактировать
          </button>
          <button
            className="w-full text-left px-4 py-3 text-[14px] text-red-600 hover:bg-[#f5f5f5] transition-colors"
            onClick={() => setOpen(false)}
          >
            Удалить
          </button>
        </div>
      )}
    </div>
  );
}
