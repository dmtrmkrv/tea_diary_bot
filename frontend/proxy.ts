import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const pathname = request.nextUrl.pathname;

  // /logout сам чистит куку и уводит на /login — пропускаем без проверок,
  // иначе при наличии (протухшей) куки proxy увёл бы его на / и была бы петля.
  if (pathname === '/logout') return NextResponse.next();

  // /privacy — публичная страница (Политика конфиденциальности). Доступна и до
  // входа (ссылка с логина), и после. Без редиректов в обе стороны.
  if (pathname === '/privacy') return NextResponse.next();

  // /login-preview — превью нового логина (Bundle B). Публичная, чтобы можно
  // было смотреть без входа. Временная: после готовности заменит /login.
  if (pathname === '/login-preview') return NextResponse.next();

  // /auth/yandex/callback — приём ответа Яндекса. Пропускаем без проверок:
  // нужен и для входа (токена ещё нет), и для будущей привязки (токен есть).
  if (pathname === '/auth/yandex/callback') return NextResponse.next();

  const isPublic = pathname === '/login' || pathname.startsWith('/auth');

  if (!token && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (token && isPublic) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
