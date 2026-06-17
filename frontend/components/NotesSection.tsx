'use client';

import { useState } from 'react';
import { CaretDownIcon, CaretUpIcon } from '@phosphor-icons/react';

export default function NotesSection({ text, limit = 160 }: { text: string; limit?: number }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > limit;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[14px] leading-[20px] text-foreground">
        {long && !expanded ? text.slice(0, limit) + '…' : text}
      </p>
      {long && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1 text-[12px] font-medium text-primary self-start"
        >
          {expanded ? 'Скрыть' : 'Показать еще'}
          {expanded ? <CaretUpIcon size={16} /> : <CaretDownIcon size={16} />}
        </button>
      )}
    </div>
  );
}
