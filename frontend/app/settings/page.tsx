'use client';

export const dynamic = 'force-dynamic';

import { Fragment, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, CaretRightIcon } from '@phosphor-icons/react';
import { toast } from 'sonner';
import ThemeSheet from '@/components/profile/ThemeSheet';
import LinkEmailSheet from '@/components/profile/LinkEmailSheet';
import ChangePasswordSheet from '@/components/profile/ChangePasswordSheet';
import { getMe, downloadTastingsCsv, type Me } from '@/lib/apiClient';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const FEEDBACK_EMAIL = 'info@leafpulse.ru';

type Sheet = 'theme' | 'linkEmail' | 'changePassword' | null;
type Row = { key: string; label: string; value?: string; onClick?: () => void };

export default function SettingsPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);

  useEffect(() => {
    let cancelled = false;
    getMe().then((m) => { if (!cancelled) setMe(m); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  function reloadMe() {
    getMe().then(setMe).catch(() => {});
  }

  function exportCsv() {
    downloadTastingsCsv().catch(() =>
      toast.error('Не удалось выгрузить данные. Попробуйте ещё раз.')
    );
  }

  async function startClaim() {
    try {
      const res = await fetch(`${API_URL}/auth/telegram/login-url?return_to=/link-telegram`);
      if (!res.ok) throw new Error();
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      toast.error('Не удалось начать перенос. Попробуйте позже.');
    }
  }

  const appRows: Row[] = [
    { key: 'theme', label: 'Настройки темы', onClick: () => setSheet('theme') },
  ];

  const accountRows: Row[] = [];
  if (me) {
    if (me.email) {
      accountRows.push({ key: 'email', label: 'E-mail', value: me.email }); // просмотр (смена — после SMTP)
    } else {
      accountRows.push({ key: 'add-email', label: 'Добавить вход по почте', onClick: () => setSheet('linkEmail') });
    }
    if (me.has_password) {
      accountRows.push({ key: 'change-password', label: 'Изменить пароль', onClick: () => setSheet('changePassword') });
    }
    accountRows.push({ key: 'export', label: 'Экспорт данных (CSV)', onClick: exportCsv });
    if (!me.has_telegram) {
      accountRows.push({ key: 'claim', label: 'Перенести записи из бота', onClick: startClaim });
    }
  }

  const serviceRows: Row[] = [
    { key: 'report', label: 'Сообщить об ошибке', onClick: () => {
      window.location.href = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent('LeafPulse: сообщение об ошибке')}`;
    } },
    { key: 'privacy', label: 'Политика конфиденциальности', onClick: () => router.push('/privacy') },
  ];

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 pt-12 pb-28">
        {/* Шапка */}
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => router.push('/profile')}
            aria-label="Назад"
            className="w-10 h-10 shrink-0 rounded-full bg-button-icon-bg border border-button-icon-border flex items-center justify-center text-text-secondary"
          >
            <ArrowLeftIcon size={18} />
          </button>
          <h1 className="text-[24px] leading-[30px] font-semibold tracking-[-1px] text-foreground">
            Настройки
          </h1>
        </div>

        <div className="flex flex-col gap-8">
          <Section title="Настройки приложения" rows={appRows} />
          <Section title="Настройки аккаунта" rows={accountRows} />
          <Card rows={serviceRows} />

          {/* Удаление аккаунта — функциональность в Шаге 3 */}
          <button
            type="button"
            onClick={() => toast('Удаление аккаунта появится скоро.')}
            className="w-full min-h-[40px] flex items-center justify-center px-6 py-[10px] rounded-full bg-button-destructive-bg border border-text-destructive shadow-xs text-[14px] font-medium text-text-destructive"
          >
            Удалить аккаунт
          </button>
        </div>
      </div>

      <ThemeSheet open={sheet === 'theme'} onClose={() => setSheet(null)} />
      {sheet === 'linkEmail' && (
        <LinkEmailSheet
          onClose={() => setSheet(null)}
          onLinked={() => { setSheet(null); reloadMe(); toast.success('Вход по почте добавлен ✓'); }}
        />
      )}
      {sheet === 'changePassword' && (
        <ChangePasswordSheet
          onClose={() => setSheet(null)}
          onChanged={() => { setSheet(null); toast.success('Пароль изменён ✓'); }}
        />
      )}
    </main>
  );
}

function Section({ title, rows }: { title: string; rows: Row[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-[18px] leading-[24px] font-semibold text-foreground">{title}</h2>
      <Card rows={rows} />
    </div>
  );
}

function Card({ rows }: { rows: Row[] }) {
  return (
    <div className="bg-card rounded-2xl shadow-sm p-4 flex flex-col gap-4">
      {rows.map((r, i) => (
        <Fragment key={r.key}>
          {i > 0 && <div className="h-px bg-border-default w-full" />}
          <RowContent row={r} />
        </Fragment>
      ))}
    </div>
  );
}

function RowContent({ row }: { row: Row }) {
  const interactive = !!row.onClick;
  return (
    <button
      type="button"
      onClick={row.onClick}
      disabled={!interactive}
      className="w-full flex items-center justify-between gap-3 text-left disabled:cursor-default"
    >
      <span className="text-[16px] leading-[24px] text-foreground shrink-0">{row.label}</span>
      {row.value !== undefined ? (
        <span className="text-[14px] text-muted-foreground truncate text-right">{row.value}</span>
      ) : interactive ? (
        <CaretRightIcon size={20} className="text-muted-foreground shrink-0" />
      ) : null}
    </button>
  );
}
