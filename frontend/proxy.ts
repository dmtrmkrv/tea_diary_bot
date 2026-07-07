import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const pathname = request.nextUrl.pathname;

  // /logout сам чистит куку и уводит на /login — пропускаем без проверок,
  // иначе при наличии (протухшей) куки proxy увёл бы его на / и была бы петля.
  if (pathname === '/logout') return NextResponse.next();

  // /api/* — BFF-прокси к бэкенду (app/api/[...path]/route.ts). Пропускаем:
  // это fetch-запросы, им нужен честный 401 от API, а не HTML-редирект на
  // /login (логин сам ходит сюда ещё без куки).
  if (pathname.startsWith('/api/')) return NextResponse.next();

  // /privacy — публичная страница (Политика конфиденциальности). Доступна и до
  // входа (ссылка с логина), и после. Без редиректов в обе стороны.
  if (pathname === '/privacy') return NextResponse.next();

  // /auth/yandex/callback — приём ответа Яндекса. Пропускаем без проверок:
  // нужен и для входа (токена ещё нет), и для будущей привязки (токен есть).
  if (pathname === '/auth/yandex/callback') return NextResponse.next();

  // /reset-password — страница из письма сброса пароля. Пропускаем без
  // проверок: открывают обычно без сессии, но валидна и с ней.
  if (pathname === '/reset-password') return NextResponse.next();

  // «/» — публичная: без токена app/page.tsx показывает лендинг, с токеном — ленту.
  if (pathname === '/') return NextResponse.next();

  // /dev/* — дев-превью (кнопки и т.п.). Только локально: в проде сами
  // страницы отдают notFound(), а без этого пропуска редирект на /login
  // скрыл бы даже 404.
  if (process.env.NODE_ENV !== 'production' && pathname.startsWith('/dev/')) {
    return NextResponse.next();
  }

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
  // `.*\\..*` — пропускаем пути с точкой (статика из /public и иконки /icon.svg):
  // иначе картинки лендинга и фавиконка 307-редиректятся на /login у незалогиненных.
  // Маршруты приложения точек не содержат и остаются под проверкой токена.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
