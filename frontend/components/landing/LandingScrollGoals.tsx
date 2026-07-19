'use client';

import { useEffect } from 'react';
import { ymGoal } from '@/lib/metrika';

// Невидимый трекер доскролла лендинга: секция впервые попала в экран →
// цель landing_scrolled с именем секции, один раз за визит страницы.
// Отвечает на вопрос «уходят, не долистав, или долистывают и не кликают».
const SECTIONS = ['features', 'cta'];

export default function LandingScrollGoals() {
  useEffect(() => {
    // Факт показа лендинга: по URL его не отличить от ленты (обе на «/»),
    // а код точно знает, что отрендерил. Цель «Просмотр лендинга» + честный
    // первый шаг воронки в Метрике.
    ymGoal('landing_view');
    const seen = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !seen.has(e.target.id)) {
            seen.add(e.target.id);
            ymGoal('landing_scrolled', { section: e.target.id });
            observer.unobserve(e.target);
          }
        }
      },
      { threshold: 0.25 },
    );
    for (const id of SECTIONS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);
  return null;
}
