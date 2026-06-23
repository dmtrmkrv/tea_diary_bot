'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { XIcon, CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';

type Props = {
  photos: string[];
  startIndex: number;
  alt: string;
  onClose: () => void;
  onIndexChange?: (i: number) => void;
};

// Полноэкранный просмотр фото дегустации. Монтируется только когда открыт.
// Dialog (Base UI: фокус-трап, Esc, scroll-lock) + Carousel (Embla: свайп/стрелки/peek).
// Фото целиком (object-contain), без кропа/зума. Соседнее фото чуть выглядывает.
export default function FullscreenGallery({ photos, startIndex, alt, onClose, onIndexChange }: Props) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(startIndex);
  const multi = photos.length > 1;

  useEffect(() => {
    if (!api) return;
    const onSelect = () => {
      const i = api.selectedScrollSnap();
      setCurrent(i);
      onIndexChange?.(i);
    };
    onSelect();
    api.on('select', onSelect);
    api.on('reInit', onSelect);
    return () => { api.off('select', onSelect); };
  }, [api, onIndexChange]);

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-[90] bg-overlay-scrim backdrop-blur-sm" />
        <DialogPrimitive.Popup className="fixed inset-0 z-[90] flex flex-col outline-none text-text-light select-none">
          <DialogPrimitive.Title className="sr-only">Просмотр фото</DialogPrimitive.Title>

          {/* Топ-бар: счётчик + крестик */}
          <div className="flex items-center justify-between px-4 pt-[max(16px,env(safe-area-inset-top))]">
            <span className="text-[14px] font-medium tabular-nums">
              {multi ? `${current + 1} / ${photos.length}` : ''}
            </span>
            <DialogPrimitive.Close
              aria-label="Закрыть"
              className="flex items-center justify-center h-10 w-10 rounded-full bg-white/10"
            >
              <XIcon size={20} />
            </DialogPrimitive.Close>
          </div>

          {/* Фото-карусель */}
          <div className="relative flex-1 min-h-0 flex items-center">
            <Carousel
              className="w-full"
              opts={{ align: 'center', startIndex, loop: false }}
              setApi={setApi}
            >
              <CarouselContent>
                {photos.map((url, i) => (
                  <CarouselItem key={i} className={multi ? 'basis-[86%]' : 'basis-full'}>
                    <div className="relative h-[78svh]">
                      <Image
                        src={url}
                        alt={`${alt} — фото ${i + 1}`}
                        fill
                        className="object-contain"
                        sizes="100vw"
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>

            {multi && (
              <>
                <button
                  type="button"
                  onClick={() => api?.scrollPrev()}
                  aria-label="Предыдущее фото"
                  className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center h-10 w-10 rounded-full bg-white/10"
                >
                  <CaretLeftIcon size={24} />
                </button>
                <button
                  type="button"
                  onClick={() => api?.scrollNext()}
                  aria-label="Следующее фото"
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center h-10 w-10 rounded-full bg-white/10"
                >
                  <CaretRightIcon size={24} />
                </button>
              </>
            )}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
