'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { parseTelegramAuth } from '@/lib/telegramAuth';
import { authTelegramReauth, type AuthError } from '@/lib/apiClient';

// Callback повторного подтверждения через Telegram (перед удалением аккаунта).
// Сюда Telegram возвращает подписанные данные; шлём их в /auth/telegram/reauth
// под текущей сессией — proof BFF кладёт в HttpOnly-куку — и возвращаем
// пользователя в настройки к шторке удаления.
export default function ReauthTelegramPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const user = parseTelegramAuth();
    if (!user) {
      setError('Не получилось получить данные от Telegram. Попробуйте ещё раз.');
      return;
    }
    // Чистим URL, чтобы подписанные данные не остались в истории.
    window.history.replaceState(null, '', window.location.pathname);
    authTelegramReauth(user)
      .then(() => {
        router.replace('/settings?reauth=ok');
      })
      .catch((e: AuthError) => {
        setError(e.message || 'Не удалось подтвердить аккаунт. Попробуйте позже.');
      });
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-background">
      {error ? (
        <div className="text-center flex flex-col items-center gap-4">
          <p className="text-[15px] leading-[22px] text-foreground">{error}</p>
          <button
            type="button"
            onClick={() => router.replace('/settings')}
            className="text-[14px] font-medium text-accent-default underline underline-offset-2"
          >
            Вернуться в настройки
          </button>
        </div>
      ) : (
        <p className="text-muted-foreground">Подтверждаем аккаунт…</p>
      )}
    </main>
  );
}
