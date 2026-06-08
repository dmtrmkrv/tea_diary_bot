'use client';

export default function ConfirmDiscardDialog({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[80] bg-overlay-scrim backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="fixed bottom-0 left-0 right-0 z-[90] bg-surface-elevated rounded-t-3xl px-4 pb-8">
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
          <button
            type="button"
            onClick={onCancel}
            className="w-full h-11 rounded-full bg-surface-sunken text-[15px] font-medium text-foreground"
          >
            Продолжить редактирование
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="w-full h-11 rounded-full border border-border-default bg-surface-elevated text-[15px] font-medium text-destructive"
          >
            Закрыть
          </button>
        </div>
      </div>
    </>
  );
}
