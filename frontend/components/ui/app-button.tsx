import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Единый стиль текстовых кнопок приложения: pill + hover/pressed по токенам
 * (спека — задача «Фронт-полировка: единый стиль кнопок» в Todoist).
 *
 * Не для иконочных круглых кнопок (back/close/gear — glass-рецепт
 * button-icon-bg) и не для лендинга (у него свои захардкоженные цвета,
 * он всегда светлый).
 */
const appButtonVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring-focus disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // Основное CTA («Сохранить», «Войти»)
        primary:
          "bg-accent-default text-primary-foreground hover:bg-accent-hover active:bg-accent-pressed",
        // Второстепенное действие («Выйти»)
        secondary:
          "border border-border-strong bg-surface-muted text-text-secondary shadow-xs hover:bg-surface-sunken active:bg-surface-sunken-strong",
        // Опасное, но не финальное («Удалить аккаунт» в настройках)
        "destructive-soft":
          "border border-text-destructive bg-button-destructive-bg text-text-destructive shadow-xs hover:bg-status-destructive/25 active:bg-status-destructive/30",
        // Финальное подтверждение удаления («Удалить навсегда» в шторке)
        "destructive-solid":
          "bg-status-destructive text-status-destructive-foreground transition-all hover:brightness-90 active:brightness-[.8]",
        // Текстовая кнопка («Отмена»)
        ghost:
          "text-text-secondary hover:bg-surface-sunken hover:text-foreground active:bg-surface-sunken-strong",
      },
      size: {
        default: "h-11 px-6 text-[14px]",
        sm: "h-9 px-4 text-[13px]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

function AppButton({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof appButtonVariants>) {
  return (
    <button
      className={cn(appButtonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { AppButton, appButtonVariants };
