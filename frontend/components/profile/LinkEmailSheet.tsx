'use client';

import { useState } from 'react';
import Link from 'next/link';
import { XIcon, EyeIcon, EyeSlashIcon } from '@phosphor-icons/react';
import { AppButton } from '@/components/ui/app-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { authLinkEmail, type AuthError } from '@/lib/apiClient';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MIN_PASSWORD = 8;

// Добавление email+пароля к текущему аккаунту (для вошедших, напр., через
// Telegram). Записи не двигаются — это тот же аккаунт.
export default function LinkEmailSheet({
  onClose,
  onLinked,
}: {
  onClose: () => void;
  onLinked: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [consented, setConsented] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim() !== '' && password !== '' && consented && !submitting;

  async function handleSubmit() {
    setError(null);
    const mail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(mail)) {
      setError('Похоже, в почте опечатка. Проверьте адрес.');
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setError(`Пароль должен быть не короче ${MIN_PASSWORD} символов.`);
      return;
    }
    setSubmitting(true);
    try {
      await authLinkEmail(mail, password, consented);
      onLinked();
    } catch (e) {
      const err = e as AuthError;
      if (err.code === 'email_taken') {
        setError('Этот email уже зарегистрирован.');
      } else if (err.code === 'email_already_set') {
        setError('К аккаунту уже привязана другая почта.');
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
          <h2 className="text-[20px] font-semibold text-foreground">Вход по почте</h2>
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
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            Добавьте почту и пароль — сможете входить ещё и так. Записи остаются на месте,
            это тот же аккаунт.
          </p>

          <div className="flex flex-col gap-1.5">
            <Label className="text-[14px] font-medium text-foreground">Адрес электронной почты</Label>
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null); }}
              placeholder="you@example.com"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-[14px] font-medium text-foreground">Пароль</Label>
            <div className="relative w-full">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null); }}
                placeholder="Не менее 8 символов"
                className="h-11 w-full min-w-0 rounded-lg border border-border-input bg-surface-input pl-4 pr-10 py-1 text-[14px] shadow-xs transition-colors outline-none placeholder:text-text-placeholder focus-visible:border-accent-default focus-visible:ring-[3px] focus-visible:ring-ring-focus"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-7 h-7 text-text-secondary hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeSlashIcon size={18} /> : <EyeIcon size={18} />}
              </button>
            </div>
          </div>

          <label className="flex items-start gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={consented}
              onChange={(e) => { setConsented(e.target.checked); setError(null); }}
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            <span className="text-[12px] leading-[16px] text-muted-foreground">
              Согласен на обработку персональных данных и принимаю{' '}
              <Link href="/privacy" target="_blank" rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-accent-default underline underline-offset-2">
                политику конфиденциальности
              </Link>
            </span>
          </label>

          {error && (
            <p className="text-[13px] leading-[18px] text-destructive">{error}</p>
          )}

          <AppButton type="button" onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? (<><Spinner className="size-4" />Минуту…</>) : 'Добавить'}
          </AppButton>
        </div>
      </div>
    </>
  );
}
