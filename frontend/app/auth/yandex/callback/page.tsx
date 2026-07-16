'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authYandex, authYandexReauth, type AuthError } from '@/lib/apiClient';
import { ymGoal } from '@/lib/metrika';

// Callback Яндекс-OAuth. Два режима (метка yandex_oauth_mode в sessionStorage):
// вход (по умолчанию) — code меняется на сессию, и повторное подтверждение
// перед удалением аккаунта (reauth) — code меняется на proof, возврат в
// настройки к шторке удаления. HttpOnly-куки в обоих случаях ставит BFF-прокси.
export default function YandexCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [backTo, setBackTo] = useState('/login');

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const code = sp.get('code');
    const returnedState = sp.get('state');
    const yandexError = sp.get('error');
    // Метки, сохранённые при старте: сверяем/читаем и сразу гасим (одноразовые).
    const savedState = sessionStorage.getItem('yandex_oauth_state');
    sessionStorage.removeItem('yandex_oauth_state');
    const isReauth = sessionStorage.getItem('yandex_oauth_mode') === 'reauth';
    sessionStorage.removeItem('yandex_oauth_mode');
    if (isReauth) setBackTo('/settings');
    if (yandexError || !code) {
      setError('Не получилось войти через Яндекс. Попробуйте ещё раз.');
      return;
    }
    // CSRF-защита: метка от Яндекса должна совпасть с сохранённой в этом браузере.
    // Не вернулась / не совпала / отсутствует — это не наш запрос на вход.
    if (!returnedState || !savedState || returnedState !== savedState) {
      setError('Вход через Яндекс не подтвердился. Откройте вход заново.');
      return;
    }
    // Убираем code из URL, чтобы не остался в истории.
    window.history.replaceState(null, '', window.location.pathname);
    (isReauth ? authYandexReauth(code) : authYandex(code))
      .then((res) => {
        // Впервые созданный аккаунт → цель «регистрация» (у email-пути она
        // уходит из AuthSheet; для Яндекса факт создания знает только бэкенд).
        if (!isReauth && (res as { created?: boolean }).created) {
          ymGoal('signup_completed', { method: 'yandex' });
        }
        router.replace(isReauth ? '/settings?reauth=ok' : '/');
      })
      .catch((e: AuthError) => {
        setError(e.message || 'Не удалось войти через Яндекс. Попробуйте позже.');
      });
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-background">
      {error ? (
        <div className="text-center flex flex-col items-center gap-4">
          <p className="text-[15px] leading-[22px] text-foreground">{error}</p>
          <button
            type="button"
            onClick={() => router.replace(backTo)}
            className="text-[14px] font-medium text-accent-default underline underline-offset-2"
          >
            {backTo === '/settings' ? 'Вернуться в настройки' : 'Вернуться ко входу'}
          </button>
        </div>
      ) : (
        <p className="text-muted-foreground">Входим через Яндекс…</p>
      )}
    </main>
  );
}
