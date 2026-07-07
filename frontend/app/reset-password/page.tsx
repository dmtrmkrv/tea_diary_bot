'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useState, type ChangeEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { EyeIcon, EyeSlashIcon } from '@phosphor-icons/react';
import { AppButton } from '@/components/ui/app-button';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { authResetPassword, type AuthError } from '@/lib/apiClient';

const MIN_PASSWORD = 8;

// Поле пароля с «глазиком» — как в ChangePasswordSheet.
function PasswordField({
  label, value, onChange, placeholder,
}: {
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
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
          autoComplete="new-password"
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

// Страница из письма сброса пароля (?token=…): новый пароль + повтор.
// Успех = бэк отозвал старые сессии и сразу залогинил (куку ставит BFF).
function ResetPasswordContent() {
  const router = useRouter();
  const token = useSearchParams().get('token') || '';
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(!token);

  async function handleSubmit() {
    setError(null);
    if (next.length < MIN_PASSWORD) {
      setError(`Пароль должен быть не короче ${MIN_PASSWORD} символов.`);
      return;
    }
    if (next !== confirm) {
      setError('Пароли не совпадают.');
      return;
    }
    setSubmitting(true);
    try {
      await authResetPassword(token, next);
      router.replace('/');
    } catch (e) {
      const err = e as AuthError;
      if (err.code === 'invalid_token') {
        setInvalid(true);
      } else {
        setError(err.message || 'Что-то пошло не так. Попробуйте ещё раз.');
      }
      setSubmitting(false);
    }
  }

  if (invalid) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 bg-background">
        <div className="text-center flex flex-col items-center gap-4">
          <p className="text-[15px] leading-[22px] text-foreground">
            Ссылка недействительна или устарела. Запросите сброс пароля ещё раз через «Забыли пароль?» на странице входа.
          </p>
          <button
            type="button"
            onClick={() => router.replace('/login')}
            className="text-[14px] font-medium text-accent-default underline underline-offset-2"
          >
            Перейти ко входу
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-md bg-card rounded-2xl shadow-sm p-6 flex flex-col gap-4">
        <h1 className="text-[20px] font-semibold text-foreground">Новый пароль</h1>
        <PasswordField
          label="Новый пароль"
          value={next}
          onChange={(e) => { setNext(e.target.value); setError(null); }}
          placeholder="Не менее 8 символов"
        />
        <PasswordField
          label="Повторите новый пароль"
          value={confirm}
          onChange={(e) => { setConfirm(e.target.value); setError(null); }}
          placeholder="Повторите пароль"
        />
        {error && <p className="text-[13px] leading-[18px] text-destructive">{error}</p>}
        <AppButton
          type="button"
          onClick={handleSubmit}
          disabled={next === '' || confirm === '' || submitting}
        >
          {submitting ? (<><Spinner className="size-4" />Минуту…</>) : 'Сохранить и войти'}
        </AppButton>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Загрузка...</p>
      </main>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
