'use client';

import { useEffect, useState } from 'react';

// Согласие на cookie. Делим состояние между CookieBanner (пишет выбор) и
// YandexMetrika (грузится только при 'all'). Реактивность — через событие:
// нажал «Принять всё» → Метрика стартует без перезагрузки.
export type CookieConsent = 'all' | 'necessary';

const KEY = 'cookie_consent';
const EVENT = 'cookie-consent-change';

export function getStoredConsent(): CookieConsent | null {
  if (typeof window === 'undefined') return null;
  const v = localStorage.getItem(KEY);
  return v === 'all' || v === 'necessary' ? v : null;
}

export function setStoredConsent(value: CookieConsent): void {
  localStorage.setItem(KEY, value);
  window.dispatchEvent(new Event(EVENT));
}

// ready=false до первого чтения localStorage (SSR/гидрация) — чтобы баннер
// не мигал и Метрика не дёргалась до того, как узнали статус.
export function useCookieConsent(): { consent: CookieConsent | null; ready: boolean } {
  const [consent, setConsent] = useState<CookieConsent | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setConsent(getStoredConsent());
    setReady(true);
    const handler = () => setConsent(getStoredConsent());
    window.addEventListener(EVENT, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  return { consent, ready };
}
