'use client';

import { EyesIcon } from '@phosphor-icons/react';

// Заглушка «ничего не найдено» — единая для поиска по дегустациям и коллекции.
// Макет Figma 194:3585. Позиция как в макете: отступ сверху под фильтрами.
export default function EmptySearch() {
  return (
    <div className="flex flex-col items-center gap-4 text-center pt-16 pb-8">
      <span className="w-[90px] h-[90px] rounded-full bg-card flex items-center justify-center">
        <EyesIcon size={40} className="text-muted-foreground" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-[16px] leading-[20px] font-medium text-text-secondary">
          Ничего не найдено
        </p>
        <p className="text-[14px] leading-[20px] text-muted-foreground">
          Измените запрос или фильтры
        </p>
      </div>
    </div>
  );
}
