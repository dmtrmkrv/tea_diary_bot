import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Чистит протухшую/невалидную куку `token` и уводит на /login.
// Нужен, чтобы при ответе API 401 не возникала петля редиректов:
// proxy гонит /login → / при наличии куки, а SSR гонит / → выход при 401.
// Здесь куку удаляем — после этого proxy видит «нет сессии» и пускает на /login.
export function GET(request: NextRequest) {
  const res = NextResponse.redirect(new URL('/login', request.url));
  res.cookies.set('token', '', { path: '/', maxAge: 0 });
  return res;
}
