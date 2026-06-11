'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  SignOutIcon,
  UserIcon,
  CaretRightIcon,
} from '@phosphor-icons/react';
import ThemeSheet from '@/components/profile/ThemeSheet';
import OnboardingSheet from '@/components/profile/OnboardingSheet';
import { getMe, getMyStats, type Me, type MyStats } from '@/lib/apiClient';

const FEEDBACK_EMAIL = 'dmitryidentity@gmail.com';

export default function ProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [stats, setStats] = useState<MyStats | null>(null);
  const [themeSheetOpen, setThemeSheetOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getMe().catch(() => null), getMyStats().catch(() => null)])
      .then(([meRes, statsRes]) => {
        if (cancelled) return;
        setMe(meRes);
        setStats(statsRes);
      });
    return () => { cancelled = true; };
  }, []);

  function logout() {
    document.cookie = 'token=; path=/; max-age=0';
    router.push('/login');
  }

  const displayName = me?.first_name || me?.username || 'Чайный человек';

  return (
    <main className="min-h-screen bg-background">
      {/* Cover — брендовая обложка (как градиент на /login, намеренно вне
          токенов тем; паттерн листьев добавим ассетом). Пока один для всех. */}
      <div className="relative h-[210px] bg-[#d97706] overflow-hidden">
        <div className="max-w-2xl mx-auto px-4 pt-12 flex items-start justify-between">
          <h1 className="text-[32px] leading-[32px] font-semibold tracking-[-1px] text-[#fafaf9]">
            Профиль
          </h1>
          <button
            type="button"
            onClick={logout}
            aria-label="Выйти"
            className="w-9 h-9 rounded-full bg-white/30 flex items-center justify-center text-[#fafaf9] backdrop-blur-sm"
          >
            <SignOutIcon size={18} />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pb-8">
        {/* Карточка профиля — наезжает на cover, аватар торчит выше */}
        <div className="relative bg-card rounded-2xl shadow-sm -mt-16 pt-12 pb-4 px-4">
          <div className="absolute -top-9 left-1/2 -translate-x-1/2 w-[72px] h-[72px] rounded-full bg-card flex items-center justify-center overflow-hidden">
            {me?.photo_url ? (
              // Внешний CDN Telegram — обычный img, без next/image конфигурации
              // eslint-disable-next-line @next/next/no-img-element
              <img src={me.photo_url} alt={displayName} className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <span className="w-16 h-16 rounded-full border-2 border-accent-default flex items-center justify-center">
                <UserIcon size={28} className="text-accent-default" />
              </span>
            )}
          </div>

          <p className="text-[20px] leading-[24px] font-semibold text-foreground text-center">
            {displayName}
          </p>

          <div className="h-px bg-border-default my-4" />

          <div className="grid grid-cols-3">
            <Stat value={stats?.tastings} label="Дегустаций" />
            <Stat value={stats?.tea_items} label="Сортов" />
            <Stat value={stats?.teaware} label="Посуда" />
          </div>

          <div className="h-px bg-border-default my-4" />

          <p className="text-[12px] leading-[16px] text-muted-foreground text-center mb-1">
            Топ категории
          </p>
          <p className="text-[16px] leading-[24px] font-medium text-foreground text-center">
            {stats && stats.top_categories.length > 0
              ? stats.top_categories.join(', ')
              : '—'}
          </p>
        </div>

        {/* Меню */}
        <div className="bg-card rounded-2xl shadow-sm mt-4 overflow-hidden">
          <MenuRow label="Темная тема" onClick={() => setThemeSheetOpen(true)} />
          <div className="h-px bg-border-default mx-4" />
          <MenuRow
            label="Возможности приложения"
            caret
            onClick={() => setOnboardingOpen(true)}
          />
          <div className="h-px bg-border-default mx-4" />
          <MenuRow
            label="Сообщить об ошибке"
            onClick={() => {
              window.location.href = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent('LeafPulse: сообщение об ошибке')}`;
            }}
          />
        </div>
      </div>

      <ThemeSheet open={themeSheetOpen} onClose={() => setThemeSheetOpen(false)} />
      <OnboardingSheet open={onboardingOpen} onClose={() => setOnboardingOpen(false)} />
    </main>
  );
}

function Stat({ value, label }: { value: number | undefined; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[28px] leading-[32px] font-semibold text-foreground">
        {value ?? '—'}
      </span>
      <span className="text-[12px] leading-[16px] text-muted-foreground">{label}</span>
    </div>
  );
}

function MenuRow({
  label,
  caret,
  onClick,
}: {
  label: string;
  caret?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 h-14 text-left transition-colors hover:bg-surface-sunken outline-none focus-visible:ring-[3px] focus-visible:ring-ring-focus focus-visible:ring-inset"
    >
      <span className="text-[15px] text-foreground">{label}</span>
      {caret && <CaretRightIcon size={18} className="text-muted-foreground shrink-0" />}
    </button>
  );
}
