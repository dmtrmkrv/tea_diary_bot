import { Skeleton } from '@/components/ui/skeleton';

// Скелетон коллекции (чай/посуда).
export default function Loading() {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 pt-12 flex flex-col gap-4">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-10 w-full rounded-full" />
        <Skeleton className="h-11 w-full rounded-lg" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    </main>
  );
}
