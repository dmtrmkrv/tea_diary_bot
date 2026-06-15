'use client';

import { useState } from 'react';
import { CaretDownIcon, CaretUpIcon, TimerIcon, DropHalfBottomIcon, BoulesIcon, DropHalfIcon, BowlFoodIcon, WindIcon, NotePencilIcon } from '@phosphor-icons/react';

interface Infusion {
  n: number;
  seconds?: number | null;
  liquor_color?: string | null;
  taste?: string | null;
  special_notes?: string | null;
  body?: string | null;
  aftertaste?: string | null;
  note?: string | null;
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
      border ? 'border-t border-border-default pt-4' : '',
      rightBorder ? 'border-r border-border-default' : '',
    ].join(' ')}>
      <span className="shrink-0 text-muted-foreground mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium leading-[16px] text-muted-foreground whitespace-nowrap">{label}</p>
        <p className="text-[14px] leading-[20px] text-foreground">{value ?? '–'}</p>
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
        icon={<BoulesIcon size={24} />}
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
          icon={<DropHalfIcon size={24} />}
          label="Особенные ноты пролива"
          value={inf.special_notes}
          wide
          border
        />
      )}
      {inf.body && (
        <DataCell
          icon={<BowlFoodIcon size={24} />}
          label="Тело"
          value={inf.body}
          wide
          border
        />
      )}
      {inf.aftertaste && (
        <DataCell
          icon={<WindIcon size={24} />}
          label="Послевкусие"
          value={inf.aftertaste}
          wide
          border
        />
      )}
      {inf.note && (
        <DataCell
          icon={<NotePencilIcon size={24} />}
          label="Заметка по проливу"
          value={inf.note}
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
    <div className="bg-card rounded-2xl shadow-md overflow-hidden">
      {infusions.map((inf, idx) => {
        const open = openSet.has(inf.n);
        const isLast = idx === infusions.length - 1;
        return (
          <div key={inf.n}>
            <button
              onClick={() => toggle(inf.n)}
              className="w-full flex items-center justify-between px-4 py-4 text-left"
            >
              <span className="text-[14px] font-semibold text-foreground">Пролив {inf.n}</span>
              {open
                ? <CaretUpIcon size={16} className="text-muted-foreground" />
                : <CaretDownIcon size={16} className="text-muted-foreground" />
              }
            </button>
            {!isLast && !open && <div className="h-px bg-border-default" />}
            {open && <InfusionContent inf={inf} />}
          </div>
        );
      })}
    </div>
  );
}
