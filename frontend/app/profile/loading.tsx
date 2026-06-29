import { Skeleton } from '@/components/ui/skeleton';

// Скелетон профиля (маршрут-переход). Повторяет раскладку нового профиля,
// чтобы стыковаться с in-page скелетоном до загрузки данных.
export default function Loading() {
  return (
    <main className="min-h-screen bg-background">
      <div className="h-[284px] rounded-b-2xl bg-surface-sunken" />
      <div className="max-w-2xl mx-auto px-4 pb-8">
        <div className="relative bg-card rounded-2xl shadow-sm -mt-16 pt-12 pb-6 px-4 flex flex-col items-center gap-[17px]">
          <div className="absolute -top-9 left-1/2 -translate-x-1/2 size-[72px] rounded-full bg-card border border-border-default" />

          <div className="flex flex-col items-center gap-2 w-full">
            <Skeleton className="h-7 w-44" />
            <Skeleton className="h-4 w-36" />
          </div>

          <div className="h-px bg-border-default w-full" />

          <div className="flex gap-9">
            {['Дегустаций', 'Сортов', 'Посуда'].map((label) => (
              <div key={label} className="flex flex-col items-center gap-2 w-[72px]">
                <Skeleton className="h-8 w-10" />
                <span className="text-[12px] leading-[16px] text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>

          <div className="h-px bg-border-default w-full" />

          <div className="flex flex-col items-center gap-2 w-full">
            <p className="text-[12px] leading-[16px] text-muted-foreground">Топ категории</p>
            <Skeleton className="h-6 w-48" />
          </div>

          <div className="h-px bg-border-default w-full" />

          <div className="flex flex-col items-center gap-3 w-full">
            <p className="text-[12px] leading-[16px] text-muted-foreground">Мои достижения</p>
            <div className="flex gap-2 pl-4 w-full overflow-hidden">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="size-[102px] rounded-xl shrink-0" />
              ))}
            </div>
          </div>
        </div>

        <Skeleton className="h-10 w-full rounded-full mt-4" />
      </div>
    </main>
  );
}
