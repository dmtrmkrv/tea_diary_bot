'use client';

import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

/**
 * Конфирм деструктивного действия (нижний диалог, по паттерну
 * ConfirmDiscardDialog). Деструктивная кнопка — soft red fill.
 */
export default function ConfirmDeleteDialog({
  open,
  title,
  description,
  confirmLabel = 'Удалить',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string | null;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useBodyScrollLock(open);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[80] bg-overlay-scrim backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-2xl z-[90] bg-card rounded-t-3xl px-4 pb-8">
        <div className="flex justify-center pt-2 pb-4">
          <span className="w-9 h-1 rounded-full bg-border-strong" />
        </div>
        <p className="text-[18px] font-semibold text-foreground mb-1">
          {title}
        </p>
        {description && (
          <p className="text-[14px] text-muted-foreground mb-6">
            {description}
          </p>
        )}
        <div className="flex flex-col gap-2 mt-2">
          <button
            type="button"
            onClick={onCancel}
            className="w-full h-11 rounded-full bg-surface-sunken text-[15px] font-medium text-foreground"
          >
            Отменить
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="w-full h-11 rounded-full bg-button-destructive-bg text-[15px] font-medium text-destructive"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}
