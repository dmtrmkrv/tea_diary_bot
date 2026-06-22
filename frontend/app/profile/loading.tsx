import { Skeleton } from '@/components/ui/skeleton';

// Скелетон профиля.
export default function Loading() {
  return (
    <main className="min-h-screen bg-background">
      <div className="h-[284px] rounded-b-2xl bg-surface-sunken" />
      <div className="max-w-2xl mx-auto px-4">
        <div className="relative bg-card rounded-2xl shadow-sm -mt-16 pt-12 pb-4 px-4 flex flex-col items-center gap-3">
          <Skeleton className="h-20 w-20 rounded-full -mt-20" />
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="flex flex-col gap-3 mt-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </main>
  );
}
