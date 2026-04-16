'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BowlSteam, Stack, User } from '@phosphor-icons/react';
import { PlusCircle } from 'lucide-react';

const links = [
  { href: '/',           label: 'Дегустации', Icon: BowlSteam  },
  { href: '/collection', label: 'Коллекция',  Icon: Stack      },
  { href: '/new',        label: 'Добавить',   Icon: PlusCircle },
  { href: '/profile',    label: 'Профиль',    Icon: User       },
];

export default function BottomNav() {
  const pathname = usePathname();

  if (pathname === '/login' || pathname.startsWith('/auth')) {
    return null;
  }

  return (
    // border-t stone/300, px-4, py-2 — по Figma
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#d6d3d1] z-50">
      <div className="max-w-2xl mx-auto flex items-center justify-between px-4 py-2">
        {links.map((link) => {
          const isActive = link.href === '/'
            ? pathname === '/'
            : pathname.startsWith(link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-col items-center gap-1 p-1 rounded-md transition-colors ${
                isActive
                  ? 'bg-[#f5f5f4]'          // stone/100 — активная вкладка
                  : ''
              } ${link.href === '/' ? 'w-[85.5px]' : 'flex-1'}`}
            >
              <link.Icon
                size={24}
                className={isActive ? 'text-[#1c1917]' : 'text-[#a8a29e]'}
                strokeWidth={1.5}
              />
              <span
                className={`font-[family-name:var(--font-inter)] text-[12px] font-medium leading-[16px] w-full text-center ${
                  isActive ? 'text-[#1c1917]' : 'text-[#a8a29e]'
                }`}
              >
                {link.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
