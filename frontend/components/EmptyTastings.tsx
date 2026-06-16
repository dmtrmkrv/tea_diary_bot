'use client';

import Link from 'next/link';
import { BowlSteamIcon, PlusIcon } from '@phosphor-icons/react';

// Пустое состояние главной — когда дегустаций нет и не задан поиск/фильтр.
// Макет Figma 44:356.
export default function EmptyTastings() {
  return (
    <div className="flex flex-col items-center justify-center gap-8 text-center min-h-[70svh]">
      <div className="flex flex-col items-center gap-4">
        <span className="w-[90px] h-[90px] rounded-full bg-card flex items-center justify-center">
          <BowlSteamIcon size={36} className="text-muted-foreground" />
        </span>
        <div className="flex flex-col gap-3">
          <p className="text-[20px] leading-[24px] font-semibold text-text-secondary">
            Дегустаций нет
          </p>
          <p className="text-[14px] leading-[20px] text-muted-foreground">
            Создайте первую дегустацию
          </p>
        </div>
      </div>
      <Link
        href="/new"
        className="flex items-center gap-2 h-10 px-6 rounded-full bg-primary text-primary-foreground text-[14px] font-medium"
      >
        <PlusIcon size={16} weight="bold" />
        Добавить дегустацию
      </Link>
    </div>
  );
}
