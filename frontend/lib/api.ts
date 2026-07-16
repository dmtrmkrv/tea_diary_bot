import { cache } from 'react';
import { redirect } from 'next/navigation';

const API_URL = process.env.API_URL || 'https://dmtrmkrv-tea-diary-bot-03bd.twc1.net';

async function getServerToken(): Promise<string> {
  try {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    return cookieStore.get('token')?.value || '';
  } catch {
    return '';
  }
}

async function apiFetch(path: string) {
  const token = await getServerToken();
  // Нет сессии — сразу на вход, без запроса к API (иначе SSR падал бы 500 на 401).
  if (!token) redirect('/login');

  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 0 },
  });
  // Кука есть, но протухла/невалидна — чистим её через /logout и уводим на вход.
  // Через /login был бы цикл: proxy гонит /login → / при наличии куки.
  if (res.status === 401) redirect('/logout');
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export type TastingsFilter = {
  q?: string;
  categories?: string;   // CSV категорий
  teawareIds?: string;   // CSV id посуды
  ratingMin?: number;
};

export async function getTastings(limit = 20, offset = 0, filter: TastingsFilter = {}) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (filter.q) params.set('q', filter.q);
  if (filter.categories) params.set('categories', filter.categories);
  if (filter.teawareIds) params.set('teaware_ids', filter.teawareIds);
  if (filter.ratingMin) params.set('rating_min', String(filter.ratingMin));
  return apiFetch(`/tastings?${params.toString()}`);
}

export async function getTeawareList() {
  return apiFetch('/collection/teaware?limit=100&offset=0');
}

// В URL — персональный номер записи (seq_no); бэкенд сам делает фолбэк по
// старому глобальному id. cache() — чтобы generateMetadata и страница
// делили один запрос за рендер.
export const getTasting = cache(async (no: number) => {
  return apiFetch(`/tastings/${no}`);
});

export async function getMe() {
  return apiFetch('/users/me');
}
