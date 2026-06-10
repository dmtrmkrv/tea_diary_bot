'use client';

import { useEffect } from 'react';

/**
 * Блокирует скролл страницы (body), пока открыта шторка/диалог.
 *
 * Счётчик нужен для вложенных оверлеев (например, ConfirmDiscardDialog
 * поверх AddTeaSheet): лок снимается только когда закрыт ПОСЛЕДНИЙ из них,
 * иначе размонтирование внутреннего диалога вернуло бы скролл, пока
 * шторка под ним ещё открыта.
 *
 * На скролл-областях внутри шторки должен стоять overscroll-contain,
 * чтобы на iOS скролл не «пробивал» на фон при достижении края.
 */

let lockCount = 0;

export function useBodyScrollLock(locked: boolean = true) {
  useEffect(() => {
    if (!locked) return;
    lockCount += 1;
    if (lockCount === 1) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      lockCount -= 1;
      if (lockCount === 0) {
        document.body.style.overflow = '';
      }
    };
  }, [locked]);
}
