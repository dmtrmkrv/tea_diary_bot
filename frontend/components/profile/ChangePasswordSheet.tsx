'use client';

import { useState, type ChangeEvent } from 'react';
import { XIcon, EyeIcon, EyeSlashIcon } from '@phosphor-icons/react';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { authChangePassword, type AuthError } from '@/lib/apiClient';

const MIN_PASSWORD = 8;

function PasswordField({
  label, value, onChange, autoComplete, placeholder,
}: {
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  autoComplete: string;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[14px] font-medium text-foreground">{label}</Label>
      <div className="relative w-full">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className="h-11 w-full min-w-0 rounded-lg border border-border-input bg-surface-input pl-4 pr-10 py-1 text-[14px] shadow-xs transition-colors outline-none placeholder:text-text-placeholder focus-visible:border-accent-default focus-visible:ring-[3px] focus-visible:ring-ring-focus"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Скрыть пароль' : 'Показать пароль'}
          className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-7 h-7 text-text-secondary hover:text-foreground transition-colors"
        >
          {show ? <EyeSlashIcon size={18} /> : <EyeIcon size={18} />}
        </button>
      </div>
    </div>
  );
}

export default function ChangePasswordSheet({
  onClose,
  onChanged,
}: {
  onClose: () => void;
  onChanged: () => void;
}) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = current !== '' && next !== '' && confirm !== '' && !submitting;

  async function handleSubmit() {
    setError(null);
    if (next.length < MIN_PASSWORD) {
      setError(`Новый пароль должен быть не короче ${MIN_PASSWORD} символов.`);
      return;
    }
    if (next !== confirm) {
      setError('Новые пароли не совпадают.');
      return;
    }
    setSubmitting(true);
    try {
      // Старые сессии отзываются (token_version); свежую куку ставит BFF-прокси.
      await authChangePassword(current, next);
      onChanged();
    } catch (e) {
      const err = e as AuthError;
      if (err.code === 'wrong_password') {
        setError('Текущий пароль неверный.');
      } else {
        setError(err.message || 'Что-то пошло не так. Попробуйте ещё раз.');
      }
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
          <h2 className="text-[20px] font-semibold text-foreground">Изменить пароль</h2>
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

        <div className="px-4 pt-4 pb-6 flex flex-col gap-4 overflow-y-auto">
          <PasswordField
            label="Текущий пароль"
            autoComplete="current-password"
            value={current}
            onChange={(e) => { setCurrent(e.target.value); setError(null); }}
            placeholder="Текущий пароль"
          />
          <PasswordField
            label="Новый пароль"
            autoComplete="new-password"
            value={next}
            onChange={(e) => { setNext(e.target.value); setError(null); }}
            placeholder="Не менее 8 символов"
          />
          <PasswordField
            label="Повторите новый пароль"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setError(null); }}
            placeholder="Повторите пароль"
          />

          {error && (
            <p className="text-[13px] leading-[18px] text-destructive">{error}</p>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="h-11 rounded-lg bg-primary text-[14px] font-medium text-primary-foreground disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (<><Spinner className="size-4" />Минуту…</>) : 'Сохранить'}
          </button>
        </div>
      </div>
    </>
  );
}
