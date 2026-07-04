import { type NextRequest } from 'next/server';

// BFF-прокси к бэкенд-API: браузер ходит только на свой домен (/api/*), сессия
// живёт в HttpOnly-куке и в JavaScript не попадает (защита JWT от увода при XSS).
// Хендлер читает куку, подставляет Authorization: Bearer и пересылает запрос.
// Ответы auth-ручек с access_token перехватываются: токен уходит в Set-Cookie,
// а из тела убирается.
const API_URL = process.env.API_URL || 'https://dmtrmkrv-tea-diary-bot-03bd.twc1.net';

// Как TOKEN_EXPIRE_SECONDS на бэке: 180 дней — редкий перелогин.
const TOKEN_MAX_AGE = 60 * 60 * 24 * 180;

function tokenCookie(token: string): string {
  // Без Secure вне production, чтобы кука работала на http://localhost:3000.
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `token=${token}; Path=/; Max-Age=${TOKEN_MAX_AGE}; HttpOnly; SameSite=Lax${secure}`;
}

async function forward(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const target = `${API_URL}/${path.join('/')}${req.nextUrl.search}`;

  const headers = new Headers();
  const contentType = req.headers.get('content-type');
  if (contentType) headers.set('Content-Type', contentType);
  const token = req.cookies.get('token')?.value;
  if (token) headers.set('Authorization', `Bearer ${token}`);
  // Реальный IP посетителя для rate-limit на бэке (client_ip в ratelimit.py
  // берёт первый адрес X-Forwarded-For) — иначе после переезда на прокси все
  // запросы приходили бы с IP Next-сервера и лимит бил бы по всем сразу.
  const xff = req.headers.get('x-forwarded-for');
  if (xff) headers.set('X-Forwarded-For', xff);

  const body =
    req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer();
  const res = await fetch(target, { method: req.method, headers, body, cache: 'no-store' });

  // Auth-ручки (login/register/code/yandex/claim/change-password) возвращают
  // access_token — кладём его в HttpOnly-куку вместо тела ответа.
  if (path[0] === 'auth' && res.ok && (res.headers.get('content-type') || '').includes('application/json')) {
    const data: unknown = await res.json();
    if (data && typeof data === 'object' && 'access_token' in data) {
      const rest: Record<string, unknown> = { ok: true };
      for (const [k, v] of Object.entries(data)) {
        if (k !== 'access_token' && k !== 'token_type') rest[k] = v;
      }
      return Response.json(rest, {
        status: res.status,
        headers: { 'Set-Cookie': tokenCookie(String((data as { access_token: unknown }).access_token)) },
      });
    }
    return Response.json(data, { status: res.status });
  }

  // Остальное — сквозной ответ (JSON, CSV-экспорт и т.п.).
  const respHeaders = new Headers();
  for (const h of ['content-type', 'content-disposition']) {
    const v = res.headers.get(h);
    if (v) respHeaders.set(h, v);
  }
  return new Response(res.body, { status: res.status, headers: respHeaders });
}

export {
  forward as GET,
  forward as POST,
  forward as PATCH,
  forward as PUT,
  forward as DELETE,
};
