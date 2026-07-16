'use client';

import { saveTelegramState, type TelegramUser } from './telegramAuth';

// Все запросы идут через BFF-прокси на своём домене (app/api/[...path]/route.ts):
// сессия — в HttpOnly-куке, браузер шлёт её сам, токен в JS не попадает.
const API_URL = '/api';

async function apiCall<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };

  const res = await fetch(`${API_URL}${path}`, { ...init, headers, cache: 'no-store' });
  if (!res.ok) {
    // Достаём понятную причину с бэка ({detail:{code,message}}), если она есть —
    // например, при отклонённой загрузке фото (размер/тип). Иначе общий текст.
    const data = await res.json().catch(() => null);
    const detail = (data as { detail?: { code?: string; message?: string } } | null)?.detail;
    const err = new Error(detail?.message || `API ${res.status}`) as Error & { status?: number; code?: string };
    err.status = res.status;
    if (detail?.code) err.code = detail.code;
    throw err;
  }
  return res.json();
}

export type TeaItem = {
  id: number;
  name: string;
  category: string | null;
  year: number | null;
  region: string | null;
  vendor: string | null;
  notes: string | null;
  amount_g: number | null;
  is_favorite: boolean;
  cover_url: string | null;
  tasting_count: number;
  avg_rating: number | null;
  created_at: string;
};

export type TeaItemList = { items: TeaItem[]; total: number };

export type TastingShort = {
  id: number;
  seq_no: number;
  name: string;
  created_at: string;
  cover_url?: string | null;
  rating: number;
  entry_mode: string;
};
export type TastingsList = { items: TastingShort[]; total: number };

export type Teaware = {
  id: number;
  name: string;
  type: string | null;
  volume_ml: number | null;
  material: string | null;
  region: string | null;
  suitable_csv: string | null;
  notes: string | null;
  cover_url: string | null;
  tasting_count: number;
  created_at: string;
};
export type TeawareList = { items: Teaware[]; total: number };

export function getTeaCollection(
  limit = 10,
  offset = 0,
  filter: { q?: string; categories?: string; favorites?: boolean } = {}
) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (filter.q) params.set('q', filter.q);
  if (filter.categories) params.set('categories', filter.categories);
  if (filter.favorites) params.set('favorites', 'true');
  return apiCall<TeaItemList>(`/collection/tea?${params.toString()}`);
}

export function getTeawareCollection(
  limit = 10,
  offset = 0,
  filter: { q?: string } = {}
) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (filter.q) params.set('q', filter.q);
  return apiCall<TeawareList>(`/collection/teaware?${params.toString()}`);
}

export function getTeaItemTastings(itemId: number, limit = 3, offset = 0) {
  return apiCall<TastingsList>(`/collection/tea/${itemId}/tastings?limit=${limit}&offset=${offset}`);
}

export type FlavorTag = { tag: string; count: number };
export type FlavorProfile = {
  aroma: FlavorTag[];
  taste: FlavorTag[];
  effects: FlavorTag[];
  records_used: number;
  avg_rating: number | null;
  last_tasting_at: string | null;
  item_created_at: string | null;
  item_is_favorite: boolean;
};

export function getTeaFlavorProfile(itemId: number) {
  return apiCall<FlavorProfile>(`/collection/tea/${itemId}/profile`);
}

export type TeaCreateInput = {
  name: string;
  category?: string | null;
  year?: number | null;
  region?: string | null;
  amount_g?: number | null;
};

export function updateTeaFavorite(itemId: number, is_favorite: boolean) {
  return apiCall<TeaItem>(`/collection/tea/${itemId}/favorite`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_favorite }),
  });
}

export function updateTeaAmount(itemId: number, amount_g: number | null) {
  return apiCall<TeaItem>(`/collection/tea/${itemId}/amount`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount_g }),
  });
}

export function createTeaItem(data: TeaCreateInput) {
  return apiCall<TeaItem>('/collection/tea', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function uploadTeaItemPhoto(itemId: number, file: File): Promise<TeaItem> {
  const fd = new FormData();
  fd.append('file', file);
  return apiCall<TeaItem>(`/collection/tea/${itemId}/photo`, {
    method: 'POST',
    body: fd,
  });
}

export type TeawareCreateInput = {
  name: string;
  type?: string | null;
  volume_ml?: number | null;
  material?: string | null;
  region?: string | null;
  suitable_csv?: string | null;
  notes?: string | null;
};

export function createTeaware(data: TeawareCreateInput) {
  return apiCall<Teaware>('/collection/teaware', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function uploadTeawarePhoto(itemId: number, file: File): Promise<Teaware> {
  const fd = new FormData();
  fd.append('file', file);
  return apiCall<Teaware>(`/collection/teaware/${itemId}/photo`, {
    method: 'POST',
    body: fd,
  });
}

export function getTeawareTastings(itemId: number, limit = 3, offset = 0) {
  return apiCall<TastingsList>(`/collection/teaware/${itemId}/tastings?limit=${limit}&offset=${offset}`);
}

export function deleteTeaware(itemId: number) {
  return apiCall<{ ok: boolean }>(`/collection/teaware/${itemId}`, { method: 'DELETE' });
}

export function deleteTeaItem(itemId: number) {
  return apiCall<{ ok: boolean }>(`/collection/tea/${itemId}`, { method: 'DELETE' });
}

export type InfusionInput = {
  n: number;
  seconds?: number | null;
  liquor_color?: string | null;
  taste?: string | null;
  special_notes?: string | null;
  body?: string | null;
  aftertaste?: string | null;
  note?: string | null;
};

export type TastingCreateInput = {
  name: string;
  tasted_date?: string | null; // YYYY-MM-DD, бэкдейтинг
  tea_item_id?: number | null;
  teaware_id?: number | null;
  grams?: number | null;
  temp_c?: number | null;
  aroma_dry?: string | null;
  aroma_warmed?: string | null;
  aroma_after?: string | null;
  effects_csv?: string | null;
  scenarios_csv?: string | null;
  rating?: number;
  summary?: string | null;
  entry_mode?: string;
  infusions?: InfusionInput[];
};

export type TastingCreatedOut = { id: number; seq_no: number };

export function createTasting(data: TastingCreateInput) {
  return apiCall<TastingCreatedOut & Record<string, unknown>>('/tastings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

// Редактирование: без entry_mode (бэкенд сохраняет режим записи как был).
export type TastingUpdateInput = Omit<TastingCreateInput, 'entry_mode' | 'aroma_after'>;

export function updateTasting(tastingId: number, data: TastingUpdateInput) {
  return apiCall<Record<string, unknown>>(`/tastings/${tastingId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export type Me = {
  id: number;
  username: string | null;
  first_name: string | null;
  photo_url: string | null;
  tz_offset_min: number;
  email: string | null;
  has_telegram: boolean;
  has_yandex: boolean;
  has_password: boolean;
};

export type MyStats = {
  tastings: number;
  tea_items: number;
  teaware: number;
  top_categories: string[];
};

export function getMe() {
  return apiCall<Me>('/users/me');
}

// Инлайн-смена отображаемого имени (пишется в first_name на бэке).
export function updateMyName(name: string) {
  return apiCall<Me>('/users/me/name', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

// Полное удаление аккаунта (необратимо). После — фронт разлогинивает.
// Подтверждение: аккаунт с паролем шлёт текущий пароль; OAuth-only аккаунт
// проходит повторный вход (proof лежит в HttpOnly-куке, BFF подставляет сам).
export function deleteMyAccount(currentPassword?: string) {
  return apiCall<{ ok: boolean }>('/users/me', {
    method: 'DELETE',
    ...(currentPassword
      ? {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ current_password: currentPassword }),
        }
      : {}),
  });
}

export function getMyStats() {
  return apiCall<MyStats>('/users/me/stats');
}

export async function downloadTastingsCsv(): Promise<void> {
  const res = await fetch(`${API_URL}/tastings/export.csv`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `leafpulse-tastings-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function deleteTasting(tastingId: number) {
  return apiCall<{ ok: boolean }>(`/tastings/${tastingId}`, { method: 'DELETE' });
}

export async function uploadTastingPhotos(tastingId: number, files: File[]): Promise<void> {
  if (files.length === 0) return;
  const fd = new FormData();
  for (const f of files) fd.append('files', f);
  await apiCall(`/tastings/${tastingId}/photos`, { method: 'POST', body: fd });
}

export function deleteTastingPhoto(tastingId: number, photoId: number) {
  return apiCall<{ ok: boolean }>(`/tastings/${tastingId}/photos/${photoId}`, {
    method: 'DELETE',
  });
}

// --- Вход по email (Arch 1). Бэк отдаёт структурную ошибку {detail:{code,message}}. ---
export type AuthError = { status: number; code?: string; message?: string };

// Успех = {ok:true}: токен BFF-прокси кладёт в HttpOnly-куку, в тело он не попадает.
async function authCall(path: string, body: unknown): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const detail = (data as { detail?: { code?: string; message?: string } }).detail;
    const err: AuthError = { status: res.status, code: detail?.code, message: detail?.message };
    throw err;
  }
  return res.json();
}

export function authRegister(email: string, password: string, consent: boolean) {
  return authCall('/auth/register', { email, password, consent });
}

export function authLogin(email: string, password: string) {
  return authCall('/auth/login', { email, password });
}

// Вход через Яндекс: обмен кода (от callback) на сессию. Токена ещё нет.
export function authYandex(code: string) {
  return authCall('/auth/yandex', { code });
}

// Сброс пароля: запрос ссылки на почту (ответ всегда ok — существование
// email не раскрывается) и установка нового пароля по токену из письма
// (сразу логинит: свежую куку ставит BFF).
export function authForgotPassword(email: string) {
  return authCall('/auth/forgot-password', { email });
}

export function authResetPassword(token: string, newPassword: string) {
  return authCall('/auth/reset-password', { token, new_password: newPassword });
}

// Те же ошибки {detail:{code,message}}, но под сессией текущего пользователя
// (привязка ключа входа к своему аккаунту / перенос записей из бота).
async function authCallAuthed<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const detail = (data as { detail?: { code?: string; message?: string } }).detail;
    const err: AuthError = { status: res.status, code: detail?.code, message: detail?.message };
    throw err;
  }
  return res.json();
}

// Путь 2: добавить email+пароль к текущему аккаунту.
export function authLinkEmail(email: string, password: string, consent: boolean) {
  return authCallAuthed<{ ok: boolean }>('/auth/link-email', { email, password, consent });
}

// Смена пароля из настроек (нужен текущий пароль). Старые сессии отзываются
// (token_version); свежий токен BFF сам кладёт в куку — устройство остаётся
// залогиненным.
export function authChangePassword(currentPassword: string, newPassword: string) {
  return authCallAuthed<{ ok: boolean }>('/auth/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
  });
}

// Путь 1: перенести записи из бота (подтверждение — подписанные данные Telegram).
// Главным становится Telegram-аккаунт; новый токен BFF кладёт в куку сам.
export function authClaim(tg: TelegramUser & { tz_offset_min?: number }) {
  return authCallAuthed<{ ok: boolean }>('/auth/claim', tg);
}

// Старт переноса записей из бота: получаем URL Telegram-OAuth (возврат на
// /link-telegram) и уводим туда. Один хелпер для настроек и онбординга.
export async function startTelegramClaim(): Promise<void> {
  const res = await fetch(`${API_URL}/auth/telegram/login-url?return_to=/link-telegram`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('claim-url');
  const { url, state } = await res.json();
  // Сохраняем метку — на возврате /link-telegram сверит её (CSRF-защита).
  if (state) saveTelegramState(state);
  window.location.href = url;
}

// --- Повторное подтверждение владения перед удалением аккаунта (OAuth-only) ---
// Успех = {ok:true}: proof BFF кладёт в HttpOnly-куку (5 минут), в JS не попадает.

export function authYandexReauth(code: string) {
  return authCallAuthed<{ ok: boolean }>('/auth/yandex/reauth', { code });
}

export function authTelegramReauth(tg: TelegramUser) {
  return authCallAuthed<{ ok: boolean }>('/auth/telegram/reauth', tg);
}

// Уводим на Яндекс-OAuth в режиме подтверждения: callback по метке mode поймёт,
// что это не вход, и вернёт пользователя в настройки к шторке удаления.
export async function startYandexReauth(): Promise<void> {
  const res = await fetch(`${API_URL}/auth/yandex/login-url`, { cache: 'no-store' });
  if (!res.ok) throw new Error('yandex-url');
  const { url, state } = await res.json();
  if (state) sessionStorage.setItem('yandex_oauth_state', state);
  sessionStorage.setItem('yandex_oauth_mode', 'reauth');
  window.location.href = url;
}

// То же для Telegram: возврат с подписанными данными на /reauth-telegram.
export async function startTelegramReauth(): Promise<void> {
  const res = await fetch(`${API_URL}/auth/telegram/login-url?return_to=/reauth-telegram`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('reauth-url');
  const { url, state } = await res.json();
  if (state) saveTelegramState(state);
  window.location.href = url;
}
