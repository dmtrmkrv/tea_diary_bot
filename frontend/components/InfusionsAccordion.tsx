'use client';

import { useState } from 'react';
import { CaretDownIcon, CaretUpIcon, TimerIcon, DropHalfBottomIcon, LeafIcon, BowlSteamIcon } from '@phosphor-icons/react';

interface Infusion {
  n: number;
  seconds?: number | null;
  liquor_color?: string | null;
  taste?: string | null;
  special_notes?: string | null;
  body?: string | null;
  aftertaste?: string | null;
}

function DataCell({
  icon,
  label,
  value,
  wide,
  border,
  rightBorder,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number | null | undefined;
  wide?: boolean;
  border?: boolean;
  rightBorder?: boolean;
}) {
  return (
    <div className={[
      'flex gap-2 items-start pb-2',
      wide ? 'col-span-2' : '',
      border ? 'border-t border-[#e7e5e4] pt-4' : '',
      rightBorder ? 'border-r border-[#e7e5e4]' : '',
    ].join(' ')}>
      <span className="shrink-0 text-[#a8a29e] mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium leading-[16px] text-[#a8a29e] whitespace-nowrap">{label}</p>
        <p className="text-[14px] leading-[20px] text-[#1c1917]">{value ?? '–'}</p>
      </div>
    </div>
  );
}

function InfusionContent({ inf }: { inf: Infusion }) {
  return (
    <div className="grid grid-cols-2 gap-x-2 gap-y-2 px-4 pt-2 pb-4">
      <DataCell
        icon={<TimerIcon size={24} />}
        label="Время"
        value={inf.seconds != null ? `${inf.seconds} сек` : null}
        rightBorder
      />
      <DataCell
        icon={<DropHalfBottomIcon size={24} />}
        label="Цвет настоя"
        value={inf.liquor_color}
      />
      {inf.taste && (
        <DataCell
          icon={<DropHalfBottomIcon size={24} />}
          label="Вкус"
          value={inf.taste}
          wide
          border
        />
      )}
      {inf.special_notes && (
        <DataCell
          icon={<LeafIcon size={24} />}
          label="Особенные ноты пролива"
          value={inf.special_notes}
          wide
          border
        />
      )}
      {inf.body && (
        <DataCell
          icon={<LeafIcon size={24} />}
          label="Тело"
          value={inf.body}
          wide
          border
        />
      )}
      {inf.aftertaste && (
        <DataCell
          icon={<BowlSteamIcon size={24} />}
          label="Послевкусие"
          value={inf.aftertaste}
          wide
          border
        />
      )}
    </div>
  );
}

export default function InfusionsAccordion({ infusions }: { infusions: Infusion[] }) {
  const [openSet, setOpenSet] = useState<Set<number>>(new Set());

  function toggle(n: number) {
    setOpenSet(prev => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });
  }

  return (
    <div className="bg-white rounded-2xl shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] overflow-hidden">
      {infusions.map((inf, idx) => {
        const open = openSet.has(inf.n);
        const isLast = idx === infusions.length - 1;
        return (
          <div key={inf.n}>
            <button
              onClick={() => toggle(inf.n)}
              className="w-full flex items-center justify-between px-4 py-4 text-left"
            >
              <span className="text-[14px] font-semibold text-[#0a0a0a]">Пролив {inf.n}</span>
              {open
                ? <CaretUpIcon size={16} className="text-[#a8a29e]" />
                : <CaretDownIcon size={16} className="text-[#a8a29e]" />
              }
            </button>
            {!isLast && !open && <div className="h-px bg-[#e5e5e5]" />}
            {open && <InfusionContent inf={inf} />}
          </div>
        );
      })}
    </div>
  );
}
