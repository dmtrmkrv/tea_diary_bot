import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const pathname = request.nextUrl.pathname;

  // /logout сам чистит куку и уводит на /login — пропускаем без проверок,
  // иначе при наличии (протухшей) куки proxy увёл бы его на / и была бы петля.
  if (pathname === '/logout') return NextResponse.next();

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
