'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authYandex, type AuthError } from '@/lib/apiClient';

// Callback входа через Яндекс: Яндекс возвращает сюда ?code=… , меняем его на
// сессию на бэке и кладём токен в куку.
export default function YandexCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const code = sp.get('code');
    const yandexError = sp.get('error');
    if (yandexError || !code) {
      setError('Не получилось войти через Яндекс. Попробуйте ещё раз.');
      return;
    }
    // Убираем code из URL, чтобы не остался в истории.
    window.history.replaceState(null, '', window.location.pathname);
    authYandex(code)
      .then(({ access_token }) => {
        document.cookie = `token=${access_token}; path=/; max-age=${60 * 60 * 24 * 180}`;
        router.replace('/');
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
            onClick={() => router.replace('/login')}
            className="text-[14px] font-medium text-accent-default underline underline-offset-2"
          >
            Вернуться ко входу
          </button>
        </div>
      ) : (
        <p className="text-muted-foreground">Входим через Яндекс…</p>
      )}
    </main>
  );
}
