'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  GearSixIcon,
  PencilSimpleLineIcon,
  CheckIcon,
  UserIcon,
  TrophyIcon,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { AppButton } from '@/components/ui/app-button';
import { Skeleton } from '@/components/ui/skeleton';
import { getMe, getMyStats, updateMyName, type Me, type MyStats } from '@/lib/apiClient';

export default function ProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [stats, setStats] = useState<MyStats | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getMe().catch(() => null), getMyStats().catch(() => null)])
      .then(([meRes, statsRes]) => {
        if (cancelled) return;
        setMe(meRes);
        setStats(statsRes);
        setLoaded(true);
      });
    return () => { cancelled = true; };
  }, []);

  // Возврат с переноса записей (/link-telegram → /profile) — одноразовый тост.
  useEffect(() => {
    if (sessionStorage.getItem('justLinked') === '1') {
      sessionStorage.removeItem('justLinked');
      toast.success('Записи из бота перенесены ✓');
    }
  }, []);

  const displayName = me?.first_name || me?.username || 'Чайный человек';
  // Идентификатор под именем: почта; если её нет (чистый Telegram) — @username.
  const identifier = me?.email || (me?.username ? `@${me.username}` : null);

  function startEdit() {
    setDraft(me?.first_name ?? '');
    setEditing(true);
  }

  async function saveName() {
    const name = draft.trim();
    if (name.length < 1) { setEditing(false); return; }
    setSaving(true);
    try {
      const updated = await updateMyName(name);
      setMe(updated);
      setEditing(false);
    } catch {
      toast.error('Не удалось сохранить имя. Попробуйте ещё раз.');
    } finally {
      setSaving(false);
    }
  }

  function logout() {
    window.location.href = '/logout';
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Cover — брендовая обложка (амбер + паттерн листьев + затемнение к низу). */}
      <div
        className="relative h-[284px] rounded-b-2xl overflow-hidden"
        style={{
          backgroundColor: '#d97706',
          backgroundImage:
            'linear-gradient(180deg, rgba(0,0,0,0.05) 50.12%, rgba(0,0,0,0.45) 90.17%), url(/cover-pattern.svg)',
          backgroundBlendMode: 'soft-light, soft-light',
        }}
      >
        <div className="max-w-2xl mx-auto px-4 pt-12 flex items-start justify-between">
          <h1 className="text-[32px] leading-[32px] font-semibold tracking-[-1px] text-[#fafaf9]">
            Профиль
          </h1>
          <button
            type="button"
            onClick={() => router.push('/settings')}
            aria-label="Настройки"
            className="w-9 h-9 rounded-full bg-button-icon-bg border border-button-icon-border flex items-center justify-center text-text-secondary backdrop-blur-sm"
          >
            <GearSixIcon size={20} />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pb-8">
        {/* Карточка профиля — наезжает на cover, аватар торчит выше */}
        <div className="relative bg-card rounded-2xl shadow-sm -mt-16 pt-12 pb-6 px-4 flex flex-col items-center gap-[17px]">
          <div className="absolute -top-9 left-1/2 -translate-x-1/2 size-[72px] rounded-full bg-card border border-border-default flex items-center justify-center">
            <UserIcon size={40} className="text-accent-default" />
          </div>

          {/* Карандаш правки имени */}
          {loaded && !editing && (
            <button
              type="button"
              onClick={startEdit}
              aria-label="Изменить имя"
              className="absolute top-[46px] right-4 p-[5px] rounded-full text-text-secondary hover:text-foreground transition-colors"
            >
              <PencilSimpleLineIcon size={20} />
            </button>
          )}

          {/* Имя + идентификатор */}
          {!loaded ? (
            <div className="flex flex-col items-center gap-2 w-full">
              <Skeleton className="h-7 w-44" />
              <Skeleton className="h-4 w-36" />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 w-full">
              {editing ? (
                <div className="flex items-center justify-center gap-2 w-full">
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveName();
                      if (e.key === 'Escape') setEditing(false);
                    }}
                    maxLength={64}
                    placeholder="Ваше имя"
                    className="min-w-0 max-w-[240px] text-center font-semibold text-foreground bg-transparent border-b border-border-strong outline-none"
                  />
                  <button
                    type="button"
                    onClick={saveName}
                    disabled={saving}
                    aria-label="Сохранить имя"
                    className="shrink-0 text-accent-default disabled:opacity-50"
                  >
                    <CheckIcon size={22} weight="bold" />
                  </button>
                </div>
              ) : (
                <p className="text-[24px] leading-[30px] font-semibold tracking-[-0.5px] text-foreground text-center">
                  {displayName}
                </p>
              )}
              {identifier && (
                <p className="text-[12px] leading-[16px] text-muted-foreground text-center break-all">
                  {identifier}
                </p>
              )}
            </div>
          )}

          <div className="h-px bg-border-default w-full" />

          {/* Статистика */}
          <div className="flex gap-9">
            <Stat value={stats?.tastings} label="Дегустаций" loading={!loaded} />
            <Stat value={stats?.tea_items} label="Сортов" loading={!loaded} />
            <Stat value={stats?.teaware} label="Посуда" loading={!loaded} />
          </div>

          <div className="h-px bg-border-default w-full" />

          {/* Топ категории */}
          <div className="flex flex-col items-center gap-2 w-full">
            <p className="text-[12px] leading-[16px] text-muted-foreground">Топ категории</p>
            {!loaded ? (
              <Skeleton className="h-6 w-48" />
            ) : (
              <p
                className={`text-[18px] leading-[24px] text-center ${
                  stats && stats.top_categories.length > 0
                    ? 'text-foreground font-medium'
                    : 'text-text-disabled'
                }`}
              >
                {stats && stats.top_categories.length > 0
                  ? stats.top_categories.join(', ')
                  : 'Пока не достаточно данных'}
              </p>
            )}
          </div>

          <div className="h-px bg-border-default w-full" />

          {/* Мои достижения — заглушка (CSS-плитки + бейдж «Скоро») */}
          <div className="flex flex-col items-center gap-3 w-full">
            <p className="text-[12px] leading-[16px] text-muted-foreground">Мои достижения</p>
            <div className="relative w-full overflow-hidden">
              <div className="flex gap-2 pl-4 blur-[5px] opacity-50" aria-hidden>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="shrink-0 flex flex-col items-center gap-2">
                    <div className="size-[102px] rounded-xl bg-surface-app flex items-center justify-center">
                      <TrophyIcon size={40} className="text-text-disabled" />
                    </div>
                    <span className="text-[12px] leading-[16px] text-text-disabled">Достижение</span>
                  </div>
                ))}
              </div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-badge-tag-bg border border-badge-tag-border rounded-full px-6 py-2 shadow-md">
                <p className="text-[18px] leading-[24px] font-semibold text-badge-tag-text">Скоро</p>
              </div>
            </div>
          </div>
        </div>

        {/* Выйти */}
        <AppButton
          type="button"
          variant="secondary"
          onClick={logout}
          className="w-full mt-4"
        >
          Выйти
        </AppButton>
      </div>
    </main>
  );
}

function Stat({
  value,
  label,
  loading,
}: {
  value: number | undefined;
  label: string;
  loading: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2 w-[72px]">
      {loading ? (
        <Skeleton className="h-8 w-10" />
      ) : (
        <span className="text-[32px] leading-[32px] font-semibold text-text-secondary tracking-[-1px]">
          {value ?? '—'}
        </span>
      )}
      <span className="text-[12px] leading-[16px] text-muted-foreground">{label}</span>
    </div>
  );
}
