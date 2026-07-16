// Title вкладки: страница сегмента — клиентский компонент, metadata можно
// экспортировать только из серверного — отсюда этот мини-layout.
export const metadata = { title: 'Коллекция' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
