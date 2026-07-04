import { type NextRequest } from 'next/server';

// BFF-прокси к бэкенд-API: браузер ходит только на свой домен (/api/*), сессия
// живёт в HttpOnly-куке и в JavaScript не попадает (защита JWT от увода при XSS).
// Хендлер читает куку, подставляет Authorization: Bearer и пересылает запрос.
// Ответы auth-ручек с access_token перехватываются: токен уходит в Set-Cookie,
// а из тела убирается.
const API_URL = process.env.API_URL || 'https://dmtrmkrv-tea-diary-bot-03bd.twc1.net';

// Как TOKEN_EXPIRE_SECONDS на бэке: 180 дней — редкий перелогин.
const TOKEN_MAX_AGE = 60 * 60 * 24 * 180;
// Как REAUTH_EXPIRE_SECONDS на бэке: proof подтверждения перед удалением аккаунта.
const REAUTH_MAX_AGE = 300;

function httpOnlyCookie(name: string, value: string, maxAge: number): string {
  // Без Secure вне production, чтобы кука работала на http://localhost:3000.
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`;
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
  // Proof повторного подтверждения (перед удалением аккаунта) — тоже HttpOnly-кука,
  // на бэк уходит заголовком.
  const reauth = req.cookies.get('reauth')?.value;
  if (reauth) headers.set('X-Reauth-Proof', reauth);

  const body =
    req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer();
  const res = await fetch(target, { method: req.method, headers, body, cache: 'no-store' });

  // Auth-ручки возвращают токены — кладём их в HttpOnly-куки вместо тела ответа:
  // access_token (login/register/code/yandex/claim/change-password) → кука token,
  // reauth_token (yandex/telegram reauth) → кука reauth.
  if (path[0] === 'auth' && res.ok && (res.headers.get('content-type') || '').includes('application/json')) {
    const data: unknown = await res.json();
    if (data && typeof data === 'object' && 'access_token' in data) {
      const rest: Record<string, unknown> = { ok: true };
      for (const [k, v] of Object.entries(data)) {
        if (k !== 'access_token' && k !== 'token_type') rest[k] = v;
      }
      return Response.json(rest, {
        status: res.status,
        headers: {
          'Set-Cookie': httpOnlyCookie('token', String((data as { access_token: unknown }).access_token), TOKEN_MAX_AGE),
        },
      });
    }
    if (data && typeof data === 'object' && 'reauth_token' in data) {
      return Response.json({ ok: true }, {
        status: res.status,
        headers: {
          'Set-Cookie': httpOnlyCookie('reauth', String((data as { reauth_token: unknown }).reauth_token), REAUTH_MAX_AGE),
        },
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
