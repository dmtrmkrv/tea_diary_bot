'use client';

import { AppButton } from '@/components/ui/app-button';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

export default function ConfirmDiscardDialog({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
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
          Закрыть без сохранения?
        </p>
        <p className="text-[14px] text-muted-foreground mb-6">
          Введённые данные будут потеряны
        </p>
        <div className="flex flex-col gap-2">
          <AppButton
            type="button"
            variant="secondary"
            onClick={onCancel}
            className="w-full"
          >
            Продолжить редактирование
          </AppButton>
          <AppButton
            type="button"
            variant="destructive-soft"
            onClick={onConfirm}
            className="w-full"
          >
            Закрыть
          </AppButton>
        </div>
      </div>
    </>
  );
}
