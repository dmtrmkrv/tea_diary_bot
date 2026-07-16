// Title вкладки: страница сегмента — клиентский компонент, metadata можно
// экспортировать только из серверного — отсюда этот мини-layout.
export const metadata = { title: 'Вход' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
