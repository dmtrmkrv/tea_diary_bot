'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import AuthSheet from '@/components/auth/AuthSheet';
import LeafPulseLogo from '@/components/LeafPulseLogo';

type Tab = 'login' | 'register';

export default function LoginPreviewPage() {
  const [tab, setTab] = useState<Tab>('login');
  const [consented, setConsented] = useState(false);
  const [sheet, setSheet] = useState<Tab | null>(null);
  const [prefillEmail, setPrefillEmail] = useState('');
  const [shakeKey, setShakeKey] = useState(0); // меняем → область согласия «подёргивается»

  // Тап по кнопке, которой нужно согласие, без галочки: трясём чекбокс + подсказка.
  function nudgeConsent() {
    setShakeKey((k) => k + 1);
    toast('Примите Политику конфиденциальности, чтобы продолжить.');
  }

  function onEmail() {
    if (tab === 'login') {
      setSheet('login'); // вход аккаунт не создаёт → согласие не нужно
    } else if (consented) {
      setSheet('register');
    } else {
      nudgeConsent();
    }
  }

  function onYandex() {
    // Яндекс = find-or-create (может создать аккаунт) → нужно согласие на обеих вкладках.
    if (consented) {
      toast('Вход через Яндекс скоро появится.');
    } else {
      nudgeConsent();
    }
  }

  // «Выглядит выключенной, но кликабельна» (Вариант A): тап ловим, согласие подсказываем.
  const emailMuted = tab === 'register' && !consented;
  const yandexMuted = !consented;

  const emailLabel = tab === 'login' ? 'Войти по электронной почте' : 'Регистрация по электронной почте';

  return (
    <>
      <main
        className="fixed inset-0 overflow-y-auto"
        style={{ background: 'linear-gradient(204.8deg, rgb(148, 232, 125) 0%, rgb(222, 203, 105) 33.875%, rgb(241, 136, 63) 100%)' }}
      >
        <div className="min-h-full flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-[400px] bg-card rounded-3xl shadow-xl px-5 py-7 flex flex-col items-center">
          {/* Лого */}
          <LeafPulseLogo className="h-[72px] w-auto mb-5" />

          <h1 className="text-[24px] font-semibold leading-[1.2] tracking-[-0.5px] text-foreground text-center">
            Твой чайный дневник<br />и коллекция
          </h1>
          <p className="text-[14px] leading-[20px] text-muted-foreground text-center mt-3">
            Собирай сорта и посуду в одном месте, записывай дегустации и отслеживай, как раскрывается каждый чай.
          </p>

          {/* Табы */}
          <div className="w-full mt-6 grid grid-cols-2 gap-1 p-1 rounded-full bg-surface-sunken">
            {(['login', 'register'] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`h-9 rounded-full text-[14px] font-medium transition-colors ${
                  tab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                {t === 'login' ? 'Вход' : 'Регистрация'}
              </button>
            ))}
          </div>

          {/* Кнопка email */}
          <button
            type="button"
            onClick={onEmail}
            className={`w-full mt-4 h-11 rounded-lg bg-primary text-[14px] font-medium text-primary-foreground transition-opacity ${emailMuted ? 'opacity-50' : ''}`}
          >
            {emailLabel}
          </button>

          <div className="w-full h-px bg-border-default my-4" />

          {/* Кнопка Яндекс */}
          <button
            type="button"
            onClick={onYandex}
            className={`w-full h-11 rounded-lg border border-border-default bg-background text-[14px] font-medium text-foreground transition-opacity ${yandexMuted ? 'opacity-50' : ''}`}
          >
            Войти через Яндекс
          </button>

          {/* Согласие */}
          <label
            key={shakeKey}
            className={`w-full mt-4 flex items-start gap-2 cursor-pointer select-none ${shakeKey > 0 ? 'lp-shake' : ''}`}
          >
            <input
              type="checkbox"
              checked={consented}
              onChange={(e) => setConsented(e.target.checked)}
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
        </div>
        </div>
      </main>

      {sheet === 'login' && (
        <AuthSheet
          mode="login"
          onClose={() => setSheet(null)}
          onSwitchToRegister={(email) => {
            // «Аккаунт не найден» → на вкладку Регистрации (там галочка согласия), почту переносим.
            setSheet(null);
            setPrefillEmail(email);
            setTab('register');
            if (!consented) nudgeConsent();
          }}
        />
      )}
      {sheet === 'register' && (
        <AuthSheet
          mode="register"
          consented={consented}
          prefillEmail={prefillEmail}
          onClose={() => setSheet(null)}
        />
      )}
    </>
  );
}
