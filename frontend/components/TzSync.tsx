'use client';

import { useEffect } from 'react';

// Автоопределение часового пояса: при заходе шлёт UTC-сдвиг браузера на бэк,
// если он изменился (DST/переезд/первый раз) — без необходимости перелогина.
// localStorage-guard, чтобы не дёргать API на каждой загрузке.
// Кука HttpOnly и из JS не видна — «залогинен ли» решает layout (рендерит
// компонент только при наличии куки), запрос идёт через BFF-прокси.
export default function TzSync() {
  useEffect(() => {
    const offset = -new Date().getTimezoneOffset(); // минуты к UTC, чтобы получить локальное
    if (localStorage.getItem('tzoff') === String(offset)) return;
    fetch('/api/users/me/tz', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tz_offset_min: offset }),
    })
      .then((r) => { if (r.ok) localStorage.setItem('tzoff', String(offset)); })
      .catch(() => {});
  }, []);
  return null;
}
