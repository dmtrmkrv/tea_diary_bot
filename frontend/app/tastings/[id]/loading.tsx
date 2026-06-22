import { Skeleton } from '@/components/ui/skeleton';

// Скелетон детальной дегустации.
export default function Loading() {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto flex flex-col gap-5 px-4 pt-12">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>
        <Skeleton className="aspect-[2/1] w-full rounded-2xl" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-7 w-2/3" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    </main>
  );
}
