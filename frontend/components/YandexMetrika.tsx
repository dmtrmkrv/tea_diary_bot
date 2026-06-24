'use client';

import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef } from 'react';

const YM_ID = process.env.NEXT_PUBLIC_YM_COUNTER_ID;

declare global {
  interface Window {
    ym?: (id: number, action: string, ...args: unknown[]) => void;
  }
}

// SPA-трекинг переходов: первую загрузку считает сам счётчик (авто-хит при
// загрузке tag.js), клиентские переходы шлём вручную через ym('hit').
function Tracker({ id }: { id: number }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const qs = searchParams.toString();
    window.ym?.(id, 'hit', pathname + (qs ? `?${qs}` : ''));
  }, [pathname, searchParams, id]);

  return null;
}

// Яндекс.Метрика. Подключается только если задан NEXT_PUBLIC_YM_COUNTER_ID
// (на стейдже без переменной не грузится). Вебвизор выключен (настройки счётчика).
export default function YandexMetrika() {
  if (!YM_ID) return null;
  const id = Number(YM_ID);

  return (
    <>
      <Script id="yandex-metrika" strategy="afterInteractive">
        {`(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");ym(${id},"init",{clickmap:true,trackLinks:true,accurateTrackBounce:true});`}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`https://mc.yandex.ru/watch/${id}`} style={{ position: 'absolute', left: '-9999px' }} alt="" />
      </noscript>
      <Suspense fallback={null}>
        <Tracker id={id} />
      </Suspense>
    </>
  );
}
