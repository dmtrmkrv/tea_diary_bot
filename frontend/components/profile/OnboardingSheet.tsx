'use client';

import { useRef, useState } from 'react';
import { XIcon, CaretLeftIcon, CaretRightIcon, ImageSquareIcon } from '@phosphor-icons/react';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

/**
 * Шторка «Возможности приложения» — онбординг-слайдер.
 * Картинки слайдов пока плейсхолдеры — заменим на выгруженные ассеты
 * (см. SLIDES[].image). Свайп + стрелки + dots.
 */

type Slide = {
  title: string;
  text: string;
  image?: string; // путь к ассету в /public, появится позже
};

const SLIDES: Slide[] = [
  {
    title: 'Дегустации',
    text: 'Ведите записи дегустаций в одном месте: выбирайте чай и посуду из коллекции, добавляйте фото, оценку, ощущения и сценарий чаепития. Единая форма поможет фиксировать вкус по проливам, аромат, тело настоя и послевкусие без хаоса в заметках.',
  },
  {
    title: 'Коллекция чая и посуды',
    text: 'Собирайте свою личную чайную полку: добавляйте сорта, чайники, гайвани, термосы и другую посуду с фото, параметрами и заметками. Всё из коллекции потом можно быстро выбрать при создании дегустации, чтобы не вводить одни и те же данные заново.',
  },
  {
    title: 'Профиль и настройки',
    text: 'Следите за общей статистикой: сколько дегустаций, сортов и посуды уже добавлено, а также какие категории чаще всего встречаются в коллекции. Здесь же можно выбрать тему оформления и быстро сообщить об ошибке или проблеме в приложении.',
  },
  {
    title: 'Быстрое добавление',
    text: 'Кнопка добавления всегда под рукой на любом экране. Через неё можно сразу создать новый сорт, добавить посуду в коллекцию или быстро начать запись дегустации.',
  },
];

export default function OnboardingSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  useBodyScrollLock(open);

  if (!open) return null;

  const slide = SLIDES[index];
  const isFirst = index === 0;
  const isLast = index === SLIDES.length - 1;

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 40) return;
    if (dx < 0) setIndex(i => Math.min(i + 1, SLIDES.length - 1));
    else setIndex(i => Math.max(i - 1, 0));
  }

  function handleClose() {
    setIndex(0);
    onClose();
  }

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-overlay-scrim backdrop-blur-sm" onClick={handleClose} />
      <div className="fixed left-1/2 -translate-x-1/2 bottom-0 w-full max-w-2xl z-[70] bg-card rounded-t-3xl flex flex-col max-h-[90dvh] overflow-hidden">
        <div className="flex justify-center pt-2 pb-1">
          <span className="w-9 h-1 rounded-full bg-border-strong" />
        </div>

        <div className="flex items-end justify-between px-4 pt-2 pb-3">
          <h2 className="text-[20px] font-semibold text-foreground">Возможности приложения</h2>
          <button
            type="button"
            onClick={handleClose}
            className="w-6 h-6 rounded-full bg-overlay-dialog flex items-center justify-center shrink-0"
          >
            <XIcon size={11} className="text-text-light" weight="bold" />
          </button>
        </div>

        <div className="h-px bg-border-default shrink-0" />

        <div
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pt-4 pb-2 flex flex-col gap-4"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* Иллюстрация слайда (ассеты подъедут позже) */}
          <div className="w-full aspect-[7/8] max-h-[420px] rounded-2xl overflow-hidden bg-surface-sunken flex items-center justify-center">
            {slide.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={slide.image} alt={slide.title} className="w-full h-full object-cover" />
            ) : (
              <ImageSquareIcon size={64} className="text-placeholder-tea-icon" />
            )}
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-[24px] leading-[30px] font-semibold tracking-[-0.5px] text-foreground">
              {slide.title}
            </h3>
            <p className="text-[14px] leading-[20px] text-text-secondary">
              {slide.text}
            </p>
          </div>
        </div>

        {/* Навигация: стрелки + dots */}
        <div className="flex items-center justify-between px-4 pt-2 pb-8 shrink-0">
          <button
            type="button"
            onClick={() => setIndex(i => Math.max(i - 1, 0))}
            disabled={isFirst}
            aria-label="Назад"
            className="w-9 h-9 flex items-center justify-center rounded-full text-foreground disabled:opacity-30 transition-opacity"
          >
            <CaretLeftIcon size={20} />
          </button>

          <div className="flex items-center gap-1.5">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Слайд ${i + 1}`}
                className={`rounded-full transition-all ${
                  i === index ? 'w-6 h-1.5 bg-foreground' : 'w-1.5 h-1.5 bg-border-strong'
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => setIndex(i => Math.min(i + 1, SLIDES.length - 1))}
            disabled={isLast}
            aria-label="Вперёд"
            className="w-9 h-9 flex items-center justify-center rounded-full text-foreground disabled:opacity-30 transition-opacity"
          >
            <CaretRightIcon size={20} />
          </button>
        </div>
      </div>
    </>
  );
}
