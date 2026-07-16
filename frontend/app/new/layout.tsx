// Title вкладки: страница сегмента — клиентский компонент, metadata можно
// экспортировать только из серверного — отсюда этот мини-layout.
export const metadata = { title: 'Новая дегустация' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
