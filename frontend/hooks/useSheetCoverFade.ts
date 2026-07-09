import { useEffect, type RefObject } from 'react';

/**
 * JS-фолбэк затемнения фото шторки при скролле — для браузеров без
 * scroll-driven CSS-анимаций (Safari < 26). Там, где CSS-путь работает
 * (.lp-sheet-cover в globals.css), хук не делает ничего.
 * Числа эффекта синхронизированы с @keyframes lp-cover-fade:
 * opacity 1→0.45, brightness 1→0.65 на первых 85% высоты фото.
 */
export function useSheetCoverFade(
  scrollRef: RefObject<HTMLElement | null>,
  coverRef: RefObject<HTMLElement | null>,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return;
    if (CSS.supports('animation-timeline: view()')) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const scroller = scrollRef.current;
    const cover = coverRef.current;
    if (!scroller || !cover) return;

    let raf = 0;
    const apply = () => {
      raf = 0;
      const range = (cover.offsetHeight || 1) * 0.85;
      const p = Math.min(1, Math.max(0, scroller.scrollTop / range));
      cover.style.opacity = String(1 - 0.55 * p);
      cover.style.filter = `brightness(${1 - 0.35 * p})`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    apply();
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [scrollRef, coverRef, enabled]);
}
