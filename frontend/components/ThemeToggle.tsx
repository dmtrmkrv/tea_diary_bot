'use client';

/**
 * Theme toggle — light / dark / system (follows OS preference).
 *
 * Uses next-themes for persistence (localStorage) and SSR-safe class swap.
 * No flash of incorrect theme — next-themes injects a pre-hydration script
 * that sets the right class before React mounts.
 *
 * UI is a vertical list of three radio-style buttons. Will be replaced when
 * the final profile design lands.
 */

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { CircleHalfIcon, MoonIcon, SunIcon } from '@phosphor-icons/react';

const OPTIONS = [
  { value: 'light', label: 'Светлая', Icon: SunIcon },
  { value: 'dark', label: 'Тёмная', Icon: MoonIcon },
  { value: 'system', label: 'Как на устройстве', Icon: CircleHalfIcon },
] as const;

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch: theme is unknown on the server, so render
  // a placeholder until the client mounts and reads localStorage / system.
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="flex flex-col gap-1">
        {OPTIONS.map((opt) => (
          <div key={opt.value} className="h-10 rounded-lg bg-surface-sunken" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {OPTIONS.map((opt) => {
        const active = theme === opt.value;
        const Icon = opt.Icon;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setTheme(opt.value)}
            aria-pressed={active}
            className={`flex items-center gap-3 px-3 h-10 rounded-lg border bg-surface-input shadow-xs transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring-focus ${
              active ? 'border-accent-default' : 'border-border-input'
            }`}
          >
            <Icon size={20} className={active ? 'text-accent-default' : 'text-text-secondary'} />
            <span className={`text-sm font-medium ${active ? 'text-foreground' : 'text-text-secondary'}`}>
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
