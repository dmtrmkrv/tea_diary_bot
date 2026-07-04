'use client';

import { useEffect, useState } from 'react';
import OnboardingSheet from '@/components/profile/OnboardingSheet';
import { getMe, type Me } from '@/lib/apiClient';

const SEEN_KEY = 'lp_onboarding_seen';

// Авто-показ онбординга при первом заходе — один раз на браузер (localStorage-флаг).
// Рендерится только в залогиненной ветке app/page.tsx (кука HttpOnly, из JS её
// не видно — «залогинен ли» решает сервер); claim-слайд внутри — если Telegram
// ещё не привязан.
export default function OnboardingGate() {
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    if (localStorage.getItem(SEEN_KEY)) return; // уже видел онбординг
    localStorage.setItem(SEEN_KEY, '1'); // показываем один раз
    getMe()
      .then((m) => { setMe(m); setOpen(true); })
      .catch(() => setOpen(true)); // профиль не подтянулся — покажем без claim-слайда
  }, []);

  if (!open) return null;
  return (
    <OnboardingSheet
      open
      onClose={() => setOpen(false)}
      showClaim={me ? !me.has_telegram : false}
    />
  );
}
