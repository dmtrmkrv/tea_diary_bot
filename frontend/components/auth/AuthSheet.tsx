'use client';

import { useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { XIcon, EyeIcon, EyeSlashIcon } from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { authLogin, authRegister, type AuthError } from '@/lib/apiClient';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MIN_PASSWORD = 8;

type Mode = 'login' | 'register';

function setSessionCookie(token: string) {
  document.cookie = `token=${token}; path=/; max-age=${60 * 60 * 24 * 180}`;
}

// Поле пароля с переключателем видимости («глазик»). Отдельно от Input,
// чтобы не толпиться с его крестиком-очисткой.
function PasswordInput({
  value, onChange, placeholder, autoComplete,
}: {
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative w-full">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
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
  );
}

export default function AuthSheet({
  mode,
  prefillEmail = '',
  consented = false,
  onClose,
  onSwitchToRegister,
}: {
  mode: Mode;
  prefillEmail?: string;
  consented?: boolean;
  onClose: () => void;
  onSwitchToRegister?: (email: string) => void;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ text: string; offerRegister?: boolean } | null>(null);

  const isRegister = mode === 'register';
  const title = isRegister ? 'Регистрация' : 'Вход по почте';
  const submitLabel = isRegister ? 'Зарегистрироваться' : 'Войти';
  const canSubmit = email.trim() !== '' && password !== ''
    && (!isRegister || password2 !== '') && !submitting;

  async function handleSubmit() {
    setError(null);
    const mail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(mail)) {
      setError({ text: 'Похоже, в почте опечатка. Проверьте адрес.' });
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setError({ text: `Пароль должен быть не короче ${MIN_PASSWORD} символов.` });
      return;
    }
    if (isRegister && password !== password2) {
      setError({ text: 'Пароли не совпадают.' });
      return;
    }

    setSubmitting(true);
    try {
      const { access_token } = isRegister
        ? await authRegister(mail, password, consented)
        : await authLogin(mail, password);
      setSessionCookie(access_token);
      router.push('/');
    } catch (e) {
      const err = e as AuthError;
      if (!isRegister && err.code === 'account_not_found') {
        setError({ text: 'Аккаунт не найден.', offerRegister: true });
      } else if (!isRegister && err.code === 'wrong_password') {
        setError({ text: 'Неверный пароль.' });
      } else if (isRegister && err.code === 'email_taken') {
        setError({ text: 'Этот email уже зарегистрирован.' });
      } else {
        setError({ text: err.message || 'Что-то пошло не так. Попробуйте ещё раз.' });
      }
      setSubmitting(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-overlay-scrim backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed left-1/2 -translate-x-1/2 bottom-0 w-full max-w-2xl z-[70] bg-card rounded-t-3xl flex flex-col max-h-[calc(100svh-48px)] overflow-hidden">
        <div className="flex justify-center pt-2 pb-1">
          <span className="w-9 h-1 rounded-full bg-border-strong" />
        </div>

        <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
          <h2 className="text-[20px] font-semibold text-foreground">{title}</h2>
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
            <PasswordInput
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null); }}
              placeholder="Не менее 8 символов"
            />
          </div>

          {isRegister && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-[14px] font-medium text-foreground">Пароль ещё раз</Label>
              <PasswordInput
                autoComplete="new-password"
                value={password2}
                onChange={(e) => { setPassword2(e.target.value); setError(null); }}
                placeholder="Повторите пароль"
              />
            </div>
          )}

          {!isRegister && (
            <button
              type="button"
              onClick={() => toast('Сброс пароля скоро появится. Пока напишите нам на info@leafpulse.ru.')}
              className="self-start text-[13px] font-medium text-accent-default"
            >
              Забыли пароль?
            </button>
          )}

          {error && (
            <p className="text-[13px] leading-[18px] text-destructive">
              {error.text}
              {error.offerRegister && onSwitchToRegister && (
                <>
                  {' '}
                  <button
                    type="button"
                    onClick={() => onSwitchToRegister(email.trim())}
                    className="underline underline-offset-2 text-accent-default"
                  >
                    Зарегистрируйтесь
                  </button>
                </>
              )}
            </p>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="h-11 rounded-lg bg-primary text-[14px] font-medium text-primary-foreground disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (<><Spinner className="size-4" />Минуту…</>) : submitLabel}
          </button>
        </div>
      </div>
    </>
  );
}
