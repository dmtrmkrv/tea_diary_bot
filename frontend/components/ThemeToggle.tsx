'use client';

/**
 * Dev-only theme toggle.
 *
 * Toggles the `.dark` class on <html>. No persistence, no system preference,
 * no ThemeProvider — refreshing the page resets to light. Used for visually
 * verifying token migration during development.
 *
 * Will be replaced by next-themes with persistence once the final profile
 * design lands.
 */

import { useEffect, useState } from 'react';
import { MoonIcon, SunIcon } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggle() {
    const next = !isDark;
    document.documentElement.classList.toggle('dark', next);
    setIsDark(next);
  }

  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex items-center gap-2">
        {isDark ? <MoonIcon size={20} /> : <SunIcon size={20} />}
        <span className="text-sm font-medium">Тёмная тема</span>
      </div>
      <Button
        type="button"
        variant={isDark ? 'default' : 'outline'}
        size="sm"
        onClick={toggle}
        aria-pressed={isDark}
      >
        {isDark ? 'Вкл' : 'Выкл'}
      </Button>
    </div>
  );
}
