'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeftIcon,
  StarIcon,
  LightningIcon,
  CaretLeftIcon,
  CaretRightIcon,
} from '@phosphor-icons/react';
import CategoryBadge from '@/components/CategoryBadge';
import TastingActions from '@/components/TastingActions';
import FullscreenGallery from '@/components/FullscreenGallery';

type Props = {
  id: number;      // глобальный id — для API-вызовов (удаление)
  seqNo: number;   // персональный номер — для URL (переход в edit)
  photos: string[];
  name: string;
  datetime: string | null;
  rating: number | null;
  isQuick: boolean;
  // legacy-бейджи показываем только когда не привязан сорт из коллекции
  category?: string | null;
  year?: number | null;
  region?: string | null;
};

// Hero детальной дегустации (состояния «с фото»): фото full-bleed фоном,
// градиент-скрим, поверх — стеклянные кнопки, дата/рейтинг/заголовок,
// legacy-бейджи (on-image) и контролы фото-карусели.
// Тап по фото → fullscreen-галерея. Фикс-высота ~400px. Макет Figma 196:5527.
export default function TastingHero({
  id, seqNo, photos, name, datetime, rating, isQuick, category, year, region,
}: Props) {
  const [current, setCurrent] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const startX = useRef<number | null>(null);
  const movedRef = useRef(false); // был ли свайп — чтобы тап после листания не открывал fullscreen
  const multi = photos.length > 1;
  const hasBadges = Boolean(category || year || region);

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
    movedRef.current = false;
  }
  function onTouchMove(e: React.TouchEvent) {
    if (startX.current !== null && Math.abs(e.touches[0].clientX - startX.current) > 10) {
      movedRef.current = true;
    }
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (startX.current === null) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    startX.current = null;
    if (Math.abs(dx) < 40) return;
    if (dx < 0) setCurrent((i) => Math.min(i + 1, photos.length - 1));
    else setCurrent((i) => Math.max(i - 1, 0));
  }

  // Тап по фото → fullscreen; после свайпа (листание hero) клик игнорируем.
  function openLightbox() {
    if (movedRef.current) { movedRef.current = false; return; }
    setLightboxOpen(true);
  }

  return (
    <>
      <div
        className="relative w-full h-[400px] select-none cursor-zoom-in"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={openLightbox}
      >
        {/* Фото + градиент клипуются по скруглению; overlay вне клипа,
            чтобы меню действий не обрезалось overflow-hidden */}
        <div className="absolute inset-0 overflow-hidden rounded-b-[24px]">
          <Image
            src={photos[current]}
            alt={name}
            fill
            priority
            sizes="(max-width: 672px) 100vw, 672px"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 from-[34%] to-black/90 to-[87%]" />
        </div>

        {/* Верхние кнопки (клик не должен открывать fullscreen) */}
        <div
          className="absolute top-4 left-4 right-4 flex items-start justify-between"
          onClick={(e) => e.stopPropagation()}
        >
          <Link
            href="/"
            aria-label="Назад"
            className="bg-button-icon-bg border border-button-icon-border flex items-center justify-center h-9 w-9 rounded-full text-foreground"
          >
            <ArrowLeftIcon size={16} />
          </Link>
          <TastingActions tastingId={id} seqNo={seqNo} />
        </div>

        {/* Нижний блок: дата/рейтинг, заголовок, бейджи, контролы (клик не открывает fullscreen) */}
        <div
          className="absolute bottom-0 left-4 right-4 flex flex-col gap-2 pb-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <p className="text-text-light text-[12px] font-medium leading-[16px]">{datetime}</p>
            <div className="flex items-center gap-1">
              {isQuick && (
                <span className="bg-white/10 border border-badge-rating-border rounded-full px-1 py-0.5 flex items-center justify-center min-w-[20px] min-h-[20px]">
                  <LightningIcon size={16} weight="fill" className="text-badge-quick-text" />
                </span>
              )}
              {rating != null && rating > 0 && (
                <span className="bg-white/10 border border-badge-rating-border rounded-full px-2 py-0.5 flex items-center gap-1 min-h-[20px]">
                  <StarIcon size={16} weight="fill" className="text-badge-rating-text" />
                  <span className="text-badge-rating-text text-[12px] font-medium leading-[16px]">{rating}/10</span>
                </span>
              )}
            </div>
          </div>

          <h1 className="text-text-light text-[24px] font-semibold leading-[30px] tracking-[-1px]">
            {name}
          </h1>

          {/* Legacy-бейджи: on-image — форс .dark, чтобы в светлой теме читались на фото */}
          {hasBadges && (
            <div className="dark flex flex-wrap gap-1">
              {category && <CategoryBadge category={category} />}
              {year && (
                <span className="border border-badge-tag-border bg-badge-tag-bg rounded-full px-2 py-0.5 text-[12px] font-semibold leading-[16px] text-badge-tag-text">
                  {year}
                </span>
              )}
              {region && (
                <span className="border border-badge-tag-border bg-badge-tag-bg rounded-full px-2 py-0.5 text-[12px] font-semibold leading-[16px] text-badge-tag-text">
                  {region}
                </span>
              )}
            </div>
          )}

          {/* Контролы карусели */}
          {multi && (
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrent((i) => Math.max(i - 1, 0))}
                disabled={current === 0}
                aria-label="Предыдущее фото"
                className="text-text-light disabled:opacity-40"
              >
                <CaretLeftIcon size={24} />
              </button>
              <div className="flex gap-1.5">
                {photos.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCurrent(i)}
                    aria-label={`Фото ${i + 1}`}
                    className={`rounded-full transition-all ${
                      i === current ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/40'
                    }`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => setCurrent((i) => Math.min(i + 1, photos.length - 1))}
                disabled={current === photos.length - 1}
                aria-label="Следующее фото"
                className="text-text-light disabled:opacity-40"
              >
                <CaretRightIcon size={24} />
              </button>
            </div>
          )}
        </div>
      </div>

      {lightboxOpen && (
        <FullscreenGallery
          photos={photos}
          startIndex={current}
          alt={name}
          onClose={() => setLightboxOpen(false)}
          onIndexChange={setCurrent}
        />
      )}
    </>
  );
}
