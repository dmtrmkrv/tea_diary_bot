'use client';

import * as React from "react"
import { useEffect, useRef, useState } from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { XIcon } from '@phosphor-icons/react'

import { cn } from "@/lib/utils"

// Типы для которых X-clear не имеет смысла — checkbox/radio/range/file и т.д.
const TYPES_WITHOUT_CLEAR = new Set([
  'checkbox', 'radio', 'range', 'file', 'hidden',
  'image', 'submit', 'reset', 'button', 'date',
]);

function Input({
  className,
  type,
  value,
  defaultValue,
  onChange,
  onFocus,
  onBlur,
  ...props
}: React.ComponentProps<"input">) {
  const inputRef = useRef<HTMLInputElement>(null);
  const supportsClear = !TYPES_WITHOUT_CLEAR.has(type ?? 'text');

  const initialHasValue =
    value !== undefined
      ? String(value).length > 0
      : defaultValue !== undefined
        ? String(defaultValue).length > 0
        : false;

  const [hasValue, setHasValue] = useState(initialHasValue);
  const [focused, setFocused] = useState(false);

  // Контролируемый value-prop — синхронизируем флаг hasValue
  useEffect(() => {
    if (value !== undefined) {
      setHasValue(String(value).length > 0);
    }
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setHasValue(e.target.value.length > 0);
    onChange?.(e);
  }

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    setFocused(true);
    onFocus?.(e);
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    setFocused(false);
    onBlur?.(e);
  }

  function handleClear() {
    const input = inputRef.current;
    if (!input) return;
    // React отслеживает input.value через свой tracker — простой
    // input.value = '' его не пробудит. Используем native setter
    // и диспатчим input-event, чтобы controlled onChange сработал.
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )?.set;
    setter?.call(input, '');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  }

  const showClear = supportsClear && focused && hasValue;

  return (
    <div className="relative w-full">
      <InputPrimitive
        ref={inputRef}
        type={type}
        data-slot="input"
        value={value}
        defaultValue={defaultValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={cn(
          "h-10 w-full min-w-0 rounded-lg border border-border-input bg-surface-input px-4 py-1 text-[14px] shadow-xs transition-colors outline-none placeholder:text-text-placeholder focus-visible:border-accent-default focus-visible:ring-[3px] focus-visible:ring-ring-focus disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive",
          showClear && "pr-9",
          className
        )}
        {...props}
      />
      {showClear && (
        <button
          type="button"
          // preventDefault на mousedown — клик по X не должен уводить фокус
          // с input (иначе focused станет false и кнопка пропадёт до клика)
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleClear}
          aria-label="Очистить"
          className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5 rounded-full bg-surface-sunken-strong text-text-secondary hover:text-foreground transition-colors"
        >
          <XIcon size={12} weight="bold" />
        </button>
      )}
    </div>
  );
}

export { Input }
