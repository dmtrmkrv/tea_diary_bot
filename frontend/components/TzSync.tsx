'use client';

import { useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

// Автоопределение часового пояса: при заходе шлёт UTC-сдвиг браузера на бэк,
// если он изменился (DST/переезд/первый раз) — без необходимости перелогина.
// localStorage-guard, чтобы не дёргать API на каждой загрузке.
export default function TzSync() {
  useEffect(() => {
    const m = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
    if (!m) return; // не залогинен — синкать нечего
    const token = decodeURIComponent(m[1]);
    const offset = -new Date().getTimezoneOffset(); // минуты к UTC, чтобы получить локальное
    if (localStorage.getItem('tzoff') === String(offset)) return;
    fetch(`${API_URL}/users/me/tz`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tz_offset_min: offset }),
    })
      .then((r) => { if (r.ok) localStorage.setItem('tzoff', String(offset)); })
      .catch(() => {});
  }, []);
  return null;
}
