'use client';

import Link from 'next/link';
import { ymGoal } from '@/lib/metrika';

// Ссылка-CTA лендинга с целью Метрики: какая кнопка привела ко входу.
// Прозрачная обёртка над Link — вёрстку задаёт вызывающий через className.
export default function LandingCtaLink({
  href,
  button,
  className,
  children,
}: {
  href: string;
  button: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={className} onClick={() => ymGoal('landing_cta_click', { button })}>
      {children}
    </Link>
  );
}
