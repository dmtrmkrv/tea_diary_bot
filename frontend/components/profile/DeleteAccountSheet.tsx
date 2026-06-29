'use client';

import { useState } from 'react';
import { XIcon } from '@phosphor-icons/react';
import { Spinner } from '@/components/ui/spinner';
import { deleteMyAccount } from '@/lib/apiClient';

// Подтверждение удаления аккаунта — необратимое действие, поэтому жёсткое
// подтверждение: галочка + отдельная красная кнопка.
export default function DeleteAccountSheet({ onClose }: { onClose: () => void }) {
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setSubmitting(true);
    setError(null);
    try {
      await deleteMyAccount();
      // Аккаунта больше нет — разлогиниваемся (чистка куки + переход на /login).
      window.location.href = '/logout';
    } catch {
      setError('Не удалось удалить аккаунт. Попробуйте позже.');
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-overlay-scrim backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 -translate-x-1/2 bottom-0 w-full max-w-2xl z-[70] bg-card rounded-t-3xl flex flex-col max-h-[calc(100svh-48px)] overflow-hidden">
        <div className="flex justify-center pt-2 pb-1">
          <span className="w-9 h-1 rounded-full bg-border-strong" />
        </div>

        <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
          <h2 className="text-[20px] font-semibold text-foreground">Удалить аккаунт</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 rounded-full bg-overlay-dialog flex items-center justify-center shrink-0"
            aria-label="Закрыть"
          >
            <XIcon size={11} className="text-text-light" weight="bold" />
          </button>
        </div>

        <div className="h-px bg-border-default shrink-0" />

        <div className="px-4 pt-4 pb-6 flex flex-col gap-4">
          <p className="text-[14px] leading-[20px] text-foreground">
            Это действие <span className="font-semibold">необратимо</span>. Все ваши данные —
            дегустации, коллекция, фотографии и настройки — будут удалены навсегда.
          </p>

          <label className="flex items-start gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => { setConfirmed(e.target.checked); setError(null); }}
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            <span className="text-[13px] leading-[18px] text-muted-foreground">
              Я понимаю, что данные удалятся безвозвратно
            </span>
          </label>

          {error && <p className="text-[13px] leading-[18px] text-destructive">{error}</p>}

          <button
            type="button"
            onClick={handleDelete}
            disabled={!confirmed || submitting}
            className="h-11 rounded-lg bg-status-destructive text-[14px] font-medium text-status-destructive-foreground disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (<><Spinner className="size-4" />Удаляем…</>) : 'Удалить аккаунт навсегда'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-lg text-[14px] font-medium text-text-secondary"
          >
            Отмена
          </button>
        </div>
      </div>
    </>
  );
}
