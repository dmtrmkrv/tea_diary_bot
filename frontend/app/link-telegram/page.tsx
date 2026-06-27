'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { parseTelegramAuth } from '@/lib/telegramAuth';
import { authClaim, type AuthError } from '@/lib/apiClient';

// Callback переноса записей из бота. Сюда Telegram возвращает подписанные
// данные (return_to=/link-telegram); отправляем их в /auth/claim под текущим
// токеном. При успехе главным становится Telegram-аккаунт → меняем токен.
const ERROR_BY_CODE: Record<string, string> = {
  no_bot_records: 'Для этого Telegram не нашлось записей бота.',
  already_linked: 'Этот Telegram уже привязан к вашему аккаунту.',
  telegram_account_has_login: 'К этому Telegram уже привязан другой вход.',
  merge_conflict: 'Не удалось объединить аккаунты — возможно, эти данные уже привязаны.',
};

export default function LinkTelegramPage() {
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
    authClaim({ ...user, tz_offset_min: -new Date().getTimezoneOffset() })
      .then(({ access_token }) => {
        document.cookie = `token=${access_token}; path=/; max-age=${60 * 60 * 24 * 180}`;
        // Сигнал «только что перенесли» — одноразовый флажок в sessionStorage,
        // чтобы не оставлять его в URL (там он залипал и повторял тост).
        sessionStorage.setItem('justLinked', '1');
        router.replace('/profile');
      })
      .catch((e: AuthError) => {
        setError((e.code && ERROR_BY_CODE[e.code]) || 'Не удалось перенести записи. Попробуйте позже.');
      });
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-background">
      {error ? (
        <div className="text-center flex flex-col items-center gap-4">
          <p className="text-[15px] leading-[22px] text-foreground">{error}</p>
          <button
            type="button"
            onClick={() => router.replace('/profile')}
            className="text-[14px] font-medium text-accent-default underline underline-offset-2"
          >
            Вернуться в профиль
          </button>
        </div>
      ) : (
        <p className="text-muted-foreground">Переносим записи из бота…</p>
      )}
    </main>
  );
}
