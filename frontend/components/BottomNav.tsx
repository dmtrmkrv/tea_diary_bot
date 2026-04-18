'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BowlSteamIcon, StackIcon, UserIcon } from '@phosphor-icons/react';
import { PlusCircle } from 'lucide-react';

const links = [
  { href: '/',           label: 'Дегустации', Icon: BowlSteamIcon },
  { href: '/collection', label: 'Коллекция',  Icon: StackIcon     },
  { href: '/new',        label: 'Добавить',   Icon: PlusCircle    },
  { href: '/profile',    label: 'Профиль',    Icon: UserIcon      },
];

export default function BottomNav() {
  const pathname = usePathname();

  if (pathname === '/login' || pathname.startsWith('/auth')) {
    return null;
  }

  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex h-[68px] w-[calc(100%-32px)] max-w-[374px] items-center overflow-hidden rounded-full border border-[#d6d3d1] bg-[rgba(255,255,255,0.8)] backdrop-blur-md p-1">
      {links.map((link) => {
        const isActive = link.href === '/'
          ? pathname === '/'
          : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex flex-1 flex-col items-center justify-center h-full rounded-full transition-colors ${
              isActive ? 'bg-[rgba(255,255,255,0.6)]' : ''
            }`}
          >
            <link.Icon
              size={24}
              className={isActive ? 'text-[#1c1917]' : 'text-[#a8a29e]'}
              strokeWidth={1.5}
            />
            <span className={`text-[10px] font-semibold leading-[16px] ${
              isActive ? 'text-[#1c1917]' : 'text-[#a8a29e]'
            }`}>
              {link.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
