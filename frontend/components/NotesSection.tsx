'use client';

import { useState } from 'react';

const LIMIT = 160;

export default function NotesSection({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > LIMIT;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[14px] leading-[20px] text-[#1c1917]">
        {long && !expanded ? text.slice(0, LIMIT) + '…' : text}
      </p>
      {long && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1 text-[12px] font-medium text-[#b45309] self-start"
        >
          {expanded ? 'Скрыть ↑' : 'Показать еще >'}
        </button>
      )}
    </div>
  );
}
