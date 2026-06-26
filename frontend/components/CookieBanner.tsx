'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCookieConsent, setStoredConsent } from '@/lib/cookieConsent';

export default function CookieBanner() {
  const { consent, ready } = useCookieConsent();
  const pathname = usePathname();

  // Показываем только пока выбор не сделан. Не на логине/auth — там аналитика
  // всё равно не грузится (гейтится согласием), а на экране логина уже есть
  // отдельный чекбокс согласия на ПДн.
  if (!ready || consent !== null) return null;
  if (pathname === '/login' || pathname.startsWith('/auth')) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] p-3">
      <div className="max-w-2xl mx-auto bg-card border border-border-default rounded-2xl shadow-lg p-4 flex flex-col gap-3">
        <p className="text-[13px] leading-[18px] text-muted-foreground">
          На сайте используются файлы cookie. Часть из них необходима для работы входа
          и сессии, часть — для аналитики (Яндекс.Метрика), которая помогает улучшать
          сервис. Аналитику можно отключить. Подробнее в{' '}
          <Link href="/privacy" className="text-foreground underline underline-offset-2">
            Политике конфиденциальности
          </Link>.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setStoredConsent('necessary')}
            className="flex-1 h-9 rounded-full bg-surface-sunken text-[13px] font-medium text-muted-foreground"
          >
            Только необходимые
          </button>
          <button
            type="button"
            onClick={() => setStoredConsent('all')}
            className="flex-1 h-9 rounded-full bg-primary text-[13px] font-medium text-primary-foreground"
          >
            Принять всё
          </button>
        </div>
      </div>
    </div>
  );
}
