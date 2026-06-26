'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeftIcon } from '@phosphor-icons/react';

// «Назад» на странице Политики: возвращаем туда, откуда пришли (напр. в
// профиль), а не жёстко на главную. Если истории нет (прямой заход) — на главную.
export default function PrivacyBackButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== 'undefined' && window.history.length > 1) router.back();
        else router.push('/');
      }}
      className="w-9 h-9 rounded-full bg-button-icon-bg border border-button-icon-border flex items-center justify-center shrink-0"
      aria-label="Назад"
    >
      <ArrowLeftIcon size={16} className="text-foreground" />
    </button>
  );
}
