'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

declare global {
  interface Window {
    TelegramLoginWidget: {
      dataOnauth: (user: TelegramUser) => void;
    };
    onTelegramAuth: (user: TelegramUser) => void;
  }
}

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

const BOT_USERNAME = process.env.NEXT_PUBLIC_BOT_USERNAME || '';
const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const botUrl = `https://t.me/${BOT_USERNAME}?start=login`;

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    window.onTelegramAuth = async (user: TelegramUser) => {
      const res = await fetch(`${API_URL}/auth/telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      });

      if (res.ok) {
        const { access_token } = await res.json();
        document.cookie = `token=${access_token}; path=/; max-age=${60 * 60 * 24 * 30}`;
        router.push('/');
      } else {
        alert('Ошибка авторизации. Попробуй ещё раз.');
      }
    };

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', BOT_USERNAME);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    script.async = true;

    const container = document.getElementById('telegram-login');
    if (container) container.appendChild(script);
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold mb-2">Чайный дневник</h1>
        <p className="text-muted-foreground mb-8">Войди через Telegram чтобы увидеть свои дегустации</p>
        <div id="telegram-login" />
        <div className="mt-6">
          <p className="text-xs text-muted-foreground mb-3">Если кнопка выше не работает:</p>
          <a
            href={botUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm hover:bg-accent transition-colors"
          >
            🍵 Войти через бот TeaNotesBot
          </a>
        </div>
      </div>
    </main>
  );
}
