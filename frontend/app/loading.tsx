import { Skeleton } from '@/components/ui/skeleton';

// Скелетон главной (список дегустаций) — показывается, пока сервер тянет данные.
export default function Loading() {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4">
        <div className="flex items-center justify-between pt-12">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>
        <Skeleton className="h-5 w-24 rounded-full mt-2" />

        <div className="flex flex-col gap-3 mt-4 pb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl overflow-hidden shadow-lg">
              <Skeleton className="aspect-[2/1] w-full rounded-none" />
              <div className="flex flex-col gap-2 px-4 py-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
