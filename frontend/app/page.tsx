import { getTastings } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import Link from 'next/link';

interface Tasting {
  id: number;
  seq_no: number;
  name: string;
  category: string;
  year: number | null;
  region: string | null;
  rating: number;
  grams: number | null;
  temp_c: number | null;
  effects_csv: string | null;
  entry_mode: string;
  cover_url: string | null;
}

export default async function Home() {
  const tastings: Tasting[] = await getTastings();

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Мои дегустации</h1>
        <p className="text-muted-foreground mt-1">{tastings.length} записей</p>
      </div>

      <div className="flex flex-col gap-3">
        {tastings.map((t) => (
          <Link key={t.id} href={`/tastings/${t.id}`}>
            <Card className="hover:bg-accent transition-colors cursor-pointer overflow-hidden">
              {t.cover_url && (
                <div className="relative w-full h-40 overflow-hidden">
                  <Image
                    src={t.cover_url}
                    alt={t.name}
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base font-medium">{t.name}</CardTitle>
                  <span className="text-sm font-semibold shrink-0">⭐ {t.rating}/10</span>
                </div>
              </CardHeader>
              <CardContent className="pb-3">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary">{t.category}</Badge>
                  {t.year && <Badge variant="outline">{t.year}</Badge>}
                  {t.region && <Badge variant="outline">{t.region}</Badge>}
                  {t.entry_mode === 'quick' && <Badge variant="outline">⚡ быстрая</Badge>}
                </div>
                {t.effects_csv && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {t.effects_csv.replace(/,/g, ' · ')}
                  </p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
