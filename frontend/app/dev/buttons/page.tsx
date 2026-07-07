'use client';

/**
 * Дев-превью единого стиля кнопок (AppButton) — все варианты и состояния
 * в обеих темах. В проде отдаёт 404, в бандл страниц пользователя не попадает.
 */

import { useEffect, useState } from 'react';
import { notFound } from 'next/navigation';
import { useTheme } from 'next-themes';
import { AppButton } from '@/components/ui/app-button';

const VARIANTS = [
  {
    variant: 'primary',
    title: 'Primary — основное CTA',
    example: 'Сохранить',
    hoverSim: 'bg-accent-hover',
    pressSim: 'bg-accent-pressed',
  },
  {
    variant: 'secondary',
    title: 'Secondary — второстепенное',
    example: 'Выйти',
    hoverSim: 'bg-surface-sunken',
    pressSim: 'bg-surface-sunken-strong',
  },
  {
    variant: 'destructive-soft',
    title: 'Destructive soft — опасное, не финальное',
    example: 'Удалить аккаунт',
    hoverSim: 'bg-status-destructive/25',
    pressSim: 'bg-status-destructive/30',
  },
  {
    variant: 'destructive-solid',
    title: 'Destructive solid — финальное подтверждение',
    example: 'Удалить навсегда',
    hoverSim: 'brightness-90',
    pressSim: 'brightness-[.8]',
  },
  {
    variant: 'ghost',
    title: 'Ghost — текстовая кнопка',
    example: 'Отмена',
    hoverSim: 'bg-surface-sunken text-foreground',
    pressSim: 'bg-surface-sunken-strong text-foreground',
  },
] as const;

const COLUMNS = ['Обычная', 'Hover', 'Pressed', 'Disabled', 'Малая (sm)'];

export default function ButtonsPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const { theme, setTheme } = useTheme();
  // Тема известна только на клиенте — до маунта не подсвечиваем активную,
  // иначе hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <main className="min-h-svh bg-background px-4 py-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[20px] font-semibold text-foreground">
              Превью кнопок (AppButton)
            </h1>
            <p className="text-[13px] text-text-secondary">
              Hover/Pressed в колонках — статичная симуляция; живые состояния
              проверяются мышью на «Обычной».
            </p>
          </div>
          <div className="flex gap-1 rounded-full bg-surface-sunken p-1">
            {(['light', 'dark', 'system'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTheme(t)}
                className={`h-8 rounded-full px-3 text-[13px] font-medium transition-colors ${
                  mounted && theme === t
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-text-secondary'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </header>

        {VARIANTS.map(({ variant, title, example, hoverSim, pressSim }) => (
          <section
            key={variant}
            className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-sm"
          >
            <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
            <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-5">
              <Cell label={COLUMNS[0]}>
                <AppButton variant={variant}>{example}</AppButton>
              </Cell>
              <Cell label={COLUMNS[1]}>
                <AppButton variant={variant} className={hoverSim}>
                  {example}
                </AppButton>
              </Cell>
              <Cell label={COLUMNS[2]}>
                <AppButton variant={variant} className={pressSim}>
                  {example}
                </AppButton>
              </Cell>
              <Cell label={COLUMNS[3]}>
                <AppButton variant={variant} disabled>
                  {example}
                </AppButton>
              </Cell>
              <Cell label={COLUMNS[4]}>
                <AppButton variant={variant} size="sm">
                  {example}
                </AppButton>
              </Cell>
            </div>
          </section>
        ))}

        <section className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-sm">
          <h2 className="text-[15px] font-semibold text-foreground">
            Типовая пара из шторки — на surface-card
          </h2>
          <div className="flex max-w-sm flex-col gap-2">
            <AppButton className="w-full">Сохранить</AppButton>
            <AppButton variant="ghost" className="w-full">
              Отмена
            </AppButton>
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-2xl border border-dashed border-border-strong p-4">
          <h2 className="text-[15px] font-semibold text-foreground">
            Та же пара — на surface-app (фон приложения)
          </h2>
          <div className="flex max-w-sm flex-col gap-2">
            <AppButton className="w-full">Сохранить</AppButton>
            <AppButton variant="ghost" className="w-full">
              Отмена
            </AppButton>
          </div>
          <p className="text-[13px] text-text-secondary">
            Для сравнения — secondary и ghost рядом на этом же фоне:
          </p>
          <div className="flex flex-wrap gap-2">
            <AppButton variant="secondary">Выйти</AppButton>
            <AppButton variant="ghost">Отмена</AppButton>
          </div>
        </section>
      </div>
    </main>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      <span className="text-[11px] uppercase tracking-wide text-text-secondary">
        {label}
      </span>
      {children}
    </div>
  );
}
