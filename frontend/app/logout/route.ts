import { NextResponse } from 'next/server';

// Чистит протухшую/невалидную куку `token` и уводит на /login.
// Нужен, чтобы при ответе API 401 не возникала петля редиректов:
// proxy гонит /login → / при наличии куки — здесь куку удаляем, и proxy
// пускает на /login.
//
// Location делаем ОТНОСИТЕЛЬНЫМ: за прокси Timeweb сервер видит запрос как
// http://localhost:3000/logout, поэтому абсолютный new URL('/login', request.url)
// уводил бы на localhost. Относительный путь браузер резолвит против публичного
// URL запроса (домен из адресной строки) — без зависимости от внутреннего хоста.
export function GET() {
  const res = new NextResponse(null, {
    status: 307,
    headers: { Location: '/login' },
  });
  res.cookies.set('token', '', { path: '/', maxAge: 0 });
  return res;
}
