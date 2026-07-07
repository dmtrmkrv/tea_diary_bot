'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { XIcon, CaretLeftIcon, CaretRightIcon, ImageSquareIcon } from '@phosphor-icons/react';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { AppButton } from '@/components/ui/app-button';
import { startTelegramClaim } from '@/lib/apiClient';

/**
 * Шторка «Возможности приложения» — онбординг-слайдер.
 * Картинки слайдов пока плейсхолдеры — заменим на выгруженные ассеты
 * (см. SLIDES[].image). Свайп + стрелки + dots.
 */

type Slide = {
  title: string;
  text: string;
  image?: string; // путь к ассету в /public, появится позже
  claim?: boolean; // последний слайд-действие: перенос записей из бота
};

// Слайд переноса добавляется в конец, только если у юзера не привязан Telegram
// (после переноса has_telegram=true → слайд исчезает, как и пункт в настройках).
const CLAIM_SLIDE: Slide = {
  title: 'Перенос записей из бота',
  text: 'Уже вели дегустации в боте @TeaNotesBot? Перенесите их в приложение — записи и коллекция подтянутся в ваш аккаунт.',
  image: '/onboarding/transfer.png',
  claim: true,
};

const SLIDES: Slide[] = [
  {
    title: 'Дегустации',
    text: 'Ведите записи дегустаций в одном месте: выбирайте чай и посуду из коллекции, добавляйте фото, оценку, ощущения и сценарий чаепития. Единая форма поможет фиксировать вкус по проливам, аромат, тело настоя и послевкусие без хаоса в заметках.',
    image: '/onboarding/tastings.png',
  },
  {
    title: 'Коллекция чая и посуды',
    text: 'Собирайте свою личную чайную полку: добавляйте сорта, чайники, гайвани, термосы и другую посуду с фото, параметрами и заметками. Всё из коллекции потом можно быстро выбрать при создании дегустации, чтобы не вводить одни и те же данные заново.',
    image: '/onboarding/collection.png',
  },
  {
    title: 'Профиль и настройки',
    text: 'Следите за общей статистикой: сколько дегустаций, сортов и посуды уже добавлено, а также какие категории чаще всего встречаются в коллекции. Здесь же можно выбрать тему оформления и быстро сообщить об ошибке или проблеме в приложении.',
    image: '/onboarding/profile.png',
  },
  {
    title: 'Быстрое добавление',
    text: 'Кнопка добавления всегда под рукой на любом экране. Через неё можно сразу создать новый сорт, добавить посуду в коллекцию или быстро начать запись дегустации.',
    image: '/onboarding/quick-add.png',
  },
];

export default function OnboardingSheet({
  open,
  onClose,
  showClaim = false,
}: {
  open: boolean;
  onClose: () => void;
  showClaim?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  useBodyScrollLock(open);

  if (!open) return null;

  const slides = showClaim ? [...SLIDES, CLAIM_SLIDE] : SLIDES;
  const slide = slides[index];
  const isFirst = index === 0;
  const isLast = index === slides.length - 1;

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 40) return;
    if (dx < 0) setIndex(i => Math.min(i + 1, slides.length - 1));
    else setIndex(i => Math.max(i - 1, 0));
  }

  function handleClose() {
    setIndex(0);
    onClose();
  }

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-overlay-scrim backdrop-blur-sm" onClick={handleClose} />
      <div className="fixed left-1/2 -translate-x-1/2 bottom-0 w-full max-w-2xl z-[70] bg-card rounded-t-3xl flex flex-col max-h-[calc(100svh-48px)] overflow-hidden">
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
          {/* Фиксированная рамка иллюстрации, аспект 3:2 (ассеты — альбомные;
              портретный скрин телефона слишком высокий и текст уходит под скролл).
              pb 66.67% = 2/3 высоты от ширины — padding-hack держит аспект без
              зависимости от aspect-ratio. object-cover не режет при совпадении
              аспекта; shrink-0 — чтобы рамка не сжималась на коротких экранах. */}
          <div className="relative w-full shrink-0 overflow-hidden rounded-2xl bg-surface-sunken">
            <div className="pb-[66.67%]" />
            {slide.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={slide.image}
                alt={slide.title}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center">
                <ImageSquareIcon size={64} className="text-placeholder-tea-icon" />
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-[24px] leading-[30px] font-semibold tracking-[-0.5px] text-foreground">
              {slide.title}
            </h3>
            <p className="text-[14px] leading-[20px] text-text-secondary">
              {slide.text}
            </p>
            {slide.claim && (
              <div className="flex gap-3 pt-3">
                <AppButton
                  type="button"
                  variant="secondary"
                  onClick={handleClose}
                  className="flex-1"
                >
                  Пропустить
                </AppButton>
                <AppButton
                  type="button"
                  onClick={async () => {
                    try {
                      await startTelegramClaim();
                    } catch {
                      toast.error('Не удалось начать перенос. Попробуйте позже.');
                    }
                  }}
                  className="flex-1"
                >
                  Перенести записи
                </AppButton>
              </div>
            )}
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
            {slides.map((_, i) => (
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
            onClick={() => setIndex(i => Math.min(i + 1, slides.length - 1))}
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
