'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Дегустации', icon: '🍵' },
  { href: '/collection', label: 'Коллекция', icon: '📦' },
  { href: '/new', label: 'Добавить', icon: '➕' },
  { href: '/profile', label: 'Профиль', icon: '👤' },
];

export default function BottomNav() {
  const pathname = usePathname();

  if (pathname === '/login' || pathname.startsWith('/auth')) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t z-50">
      <div className="max-w-2xl mx-auto flex">
        {links.map((link) => {
          const isActive = link.href === '/'
            ? pathname === '/'
            : pathname.startsWith(link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex-1 flex flex-col items-center py-3 gap-1 text-xs transition-colors ${
                isActive
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className="text-xl">{link.icon}</span>
              <span>{link.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
