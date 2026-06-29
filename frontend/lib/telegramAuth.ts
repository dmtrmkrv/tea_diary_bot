// Разбор подписанных данных, которые Telegram возвращает после авторизации.
// Используется на /login (обычный вход) и /link-telegram (перенос из бота).

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

// Данные могут вернуться либо в hash (#tgAuthResult=base64url(json)),
// либо в query (?id=&hash=…). Поддерживаем оба варианта.
export function parseTelegramAuth(): TelegramUser | null {
  if (typeof window === 'undefined') return null;

  const hashMatch = window.location.hash.match(/tgAuthResult=([^&]+)/);
  if (hashMatch) {
    try {
      let b64 = decodeURIComponent(hashMatch[1]).replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      return JSON.parse(new TextDecoder('utf-8').decode(bytes)) as TelegramUser;
    } catch {
      /* пустой — упадём в проверку query ниже */
    }
  }

  const sp = new URLSearchParams(window.location.search);
  if (sp.get('id') && sp.get('hash')) {
    return {
      id: Number(sp.get('id')),
      first_name: sp.get('first_name') ?? '',
      last_name: sp.get('last_name') ?? undefined,
      username: sp.get('username') ?? undefined,
      photo_url: sp.get('photo_url') ?? undefined,
      auth_date: Number(sp.get('auth_date')),
      hash: sp.get('hash') as string,
    };
  }
  return null;
}
