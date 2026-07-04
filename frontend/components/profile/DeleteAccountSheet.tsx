'use client';

import { useState } from 'react';
import { XIcon, CheckCircleIcon } from '@phosphor-icons/react';
import { Spinner } from '@/components/ui/spinner';
import {
  deleteMyAccount,
  startTelegramReauth,
  startYandexReauth,
  type Me,
} from '@/lib/apiClient';

// Подтверждение удаления аккаунта — необратимое действие, поэтому жёсткое
// подтверждение: галочка + доказательство владения (украденной сессии мало):
// аккаунт с паролем вводит текущий пароль, OAuth-only проходит повторный
// вход через Яндекс/Telegram (proof живёт 5 минут в HttpOnly-куке; после
// возврата из OAuth настройки снова открывают эту шторку с proofConfirmed).
export default function DeleteAccountSheet({
  me,
  proofConfirmed = false,
  onClose,
}: {
  me: Me;
  proofConfirmed?: boolean;
  onClose: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [password, setPassword] = useState('');
  const [hasProof, setHasProof] = useState(proofConfirmed);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsPassword = me.has_password;
  const canDelete = confirmed && !submitting
    && (needsPassword ? password !== '' : hasProof);

  async function handleDelete() {
    setSubmitting(true);
    setError(null);
    try {
      await deleteMyAccount(needsPassword ? password : undefined);
      // Аккаунта больше нет — разлогиниваемся (чистка куки + переход на /login).
      window.location.href = '/logout';
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code === 'wrong_password') {
        setError('Текущий пароль неверный.');
      } else if (err.code === 'reauth_required') {
        // Proof истёк (5 минут) или не дошёл — просим подтвердить заново.
        setHasProof(false);
        setError('Подтверждение истекло — подтвердите аккаунт ещё раз.');
      } else {
        setError('Не удалось удалить аккаунт. Попробуйте позже.');
      }
      setSubmitting(false);
    }
  }

  function startReauth(kind: 'yandex' | 'telegram') {
    setError(null);
    (kind === 'yandex' ? startYandexReauth() : startTelegramReauth()).catch(() =>
      setError('Не удалось начать подтверждение. Попробуйте позже.')
    );
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

          {needsPassword ? (
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null); }}
              placeholder="Текущий пароль"
              autoComplete="current-password"
              className="h-11 w-full min-w-0 rounded-lg border border-border-input bg-surface-input px-4 py-1 text-[14px] shadow-xs transition-colors outline-none placeholder:text-text-placeholder focus-visible:border-accent-default focus-visible:ring-[3px] focus-visible:ring-ring-focus"
            />
          ) : hasProof ? (
            <p className="flex items-center gap-2 text-[14px] leading-[20px] text-foreground">
              <CheckCircleIcon size={20} weight="fill" className="text-status-success shrink-0" />
              Аккаунт подтверждён — можно удалить
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-[13px] leading-[18px] text-muted-foreground">
                Для удаления подтвердите, что аккаунт ваш:
              </p>
              {me.has_yandex && (
                <button
                  type="button"
                  onClick={() => startReauth('yandex')}
                  className="h-11 rounded-lg border border-border-input bg-surface-input text-[14px] font-medium text-foreground"
                >
                  Подтвердить через Яндекс
                </button>
              )}
              {me.has_telegram && (
                <button
                  type="button"
                  onClick={() => startReauth('telegram')}
                  className="h-11 rounded-lg border border-border-input bg-surface-input text-[14px] font-medium text-foreground"
                >
                  Подтвердить через Telegram
                </button>
              )}
            </div>
          )}

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
            disabled={!canDelete}
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
