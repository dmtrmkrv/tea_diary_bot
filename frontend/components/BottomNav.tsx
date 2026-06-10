'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  BowlSteamIcon,
  StackIcon,
  UserIcon,
  PlusCircleIcon,
  XCircleIcon,
} from '@phosphor-icons/react';

const navLinks = [
  { href: '/',           label: 'Дегустации', Icon: BowlSteamIcon },
  { href: '/collection', label: 'Коллекция',  Icon: StackIcon     },
  { href: '/profile',    label: 'Профиль',    Icon: UserIcon      },
];

type AddAction =
  | { kind: 'link'; label: string; href: string }
  | { kind: 'sheet'; label: string; sheet: 'tea' | 'teaware' };

const addActions: AddAction[] = [
  { kind: 'link',  label: 'Дегустацию', href: '/new'      },
  { kind: 'sheet', label: 'Посуду',     sheet: 'teaware'  },
  { kind: 'sheet', label: 'Чай',        sheet: 'tea'      },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  if (pathname === '/login' || pathname.startsWith('/auth') || pathname === '/new') return null;

  function openSheet(name: 'tea' | 'teaware') {
    const params = new URLSearchParams(searchParams.toString());
    params.set('add', name);
    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-overlay-scrim backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {open && (
        <div className="fixed bottom-[92px] left-1/2 -translate-x-1/2 w-[calc(100%-16px)] max-w-[414px] z-50 flex flex-col items-end gap-2">
          {addActions.map((a) => {
            const cls = "flex h-12 items-center justify-center rounded-full border border-border-strong bg-nav-bg backdrop-blur-md px-5 text-[16px] font-medium text-foreground";
            if (a.kind === 'link') {
              return (
                <Link key={a.label} href={a.href} onClick={() => setOpen(false)} className={cls}>
                  {a.label}
                </Link>
              );
            }
            return (
              <button key={a.label} type="button" onClick={() => openSheet(a.sheet)} className={cls}>
                {a.label}
              </button>
            );
          })}
        </div>
      )}

      <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex gap-2 w-[calc(100%-16px)] min-w-[320px] max-w-[414px]">
        <div className="flex flex-1 h-[68px] items-center rounded-full border border-border-strong bg-nav-bg backdrop-blur-md p-1 overflow-hidden">
          {navLinks.map(({ href, label, Icon }) => {
            const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-1 flex-col items-center justify-center h-full rounded-full transition-colors ${
                  isActive ? 'bg-nav-selected-bg' : ''
                }`}
              >
                <Icon size={24} className={isActive ? 'text-nav-icon-active' : 'text-nav-icon-inactive'} />
                <span className={`text-[10px] font-semibold leading-[16px] ${
                  isActive ? 'text-nav-text-active' : 'text-nav-text-inactive'
                }`}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>

        <button
          onClick={() => setOpen(v => !v)}
          className="flex h-[68px] w-[70px] shrink-0 items-center justify-center rounded-full border border-border-strong bg-nav-bg backdrop-blur-md"
        >
          {open
            ? <XCircleIcon size={40} weight="light" className="text-nav-icon-inactive" />
            : <PlusCircleIcon size={40} weight="light" className="text-nav-icon-inactive" />
          }
        </button>
      </nav>
    </>
  );
}
