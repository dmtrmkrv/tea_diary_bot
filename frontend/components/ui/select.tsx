'use client';

import * as React from 'react';
import { CaretDownIcon } from '@phosphor-icons/react';

import { cn } from '@/lib/utils';

/**
 * Нативный <select>, стилизованный под наши инпуты (surface-input +
 * border-input + focus ring). Выпадающий список остаётся системным —
 * на мобиле это нативный пикер, что и нужно. Поддерживает <optgroup>.
 *
 * Псевдо-placeholder: когда value пустой, текст красится в
 * text-placeholder (у select нет настоящего placeholder — первый
 * <option value=""> играет его роль).
 */
function Select({
  className,
  value,
  children,
  ...props
}: React.ComponentProps<'select'>) {
  const isEmpty = value === '' || value == null;
  return (
    <div className="relative w-full">
      <select
        data-slot="select"
        value={value}
        className={cn(
          'h-10 w-full min-w-0 appearance-none rounded-lg border border-border-input bg-surface-input pl-4 pr-9 py-1 text-[14px] shadow-xs transition-colors outline-none focus-visible:border-accent-default focus-visible:ring-[3px] focus-visible:ring-ring-focus disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive',
          isEmpty ? 'text-text-placeholder' : 'text-foreground',
          className
        )}
        {...props}
      >
        {children}
      </select>
      <CaretDownIcon
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-placeholder"
      />
    </div>
  );
}

export { Select };
