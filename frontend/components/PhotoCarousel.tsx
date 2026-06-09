'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';

export default function PhotoCarousel({ urls, alt }: { urls: string[]; alt: string }) {
  const [current, setCurrent] = useState(0);
  const touchStartX = useRef<number | null>(null);

  if (urls.length === 0) return null;

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 40) return;
    if (dx < 0) setCurrent(i => Math.min(i + 1, urls.length - 1));
    else setCurrent(i => Math.max(i - 1, 0));
  }

  return (
    <div className="flex flex-col items-center">
      <div
        className="relative w-full aspect-[2/1] rounded-2xl overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <Image
          src={urls[current]}
          alt={alt}
          fill
          className="object-cover"
        />
      </div>
      {urls.length > 1 && (
        <div className="flex gap-1.5 mt-2">
          {urls.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`rounded-full transition-all ${
                i === current ? 'w-4 h-1.5 bg-foreground' : 'w-1.5 h-1.5 bg-border-strong'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
