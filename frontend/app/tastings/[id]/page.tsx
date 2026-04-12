import { getTasting } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import Image from 'next/image';
import Link from 'next/link';

export default async function TastingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTasting(Number(id));

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <Link href="/" className="text-sm text-muted-foreground hover:underline mb-6 block">
        ← Назад
      </Link>

      <div className="mb-4">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-2xl font-semibold">{t.name}</h1>
          <span className="text-lg font-semibold shrink-0">⭐ {t.rating}/10</span>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3">
          <Badge variant="secondary">{t.category}</Badge>
          {t.year && <Badge variant="outline">{t.year}</Badge>}
          {t.region && <Badge variant="outline">{t.region}</Badge>}
          {t.entry_mode === 'quick' && <Badge variant="outline">⚡ быстрая</Badge>}
        </div>
      </div>

      {t.photo_urls && t.photo_urls.length > 0 && (
        <Carousel className="w-full my-4">
          <CarouselContent>
            {t.photo_urls.map((url: string, i: number) => (
              <CarouselItem key={i}>
                <div className="relative w-full h-80">
                  <Image
                    src={url}
                    alt={`Фото ${i + 1}`}
                    fill
                    className="rounded-lg object-cover"
                  />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          {t.photo_urls.length > 1 && (
            <>
              <CarouselPrevious />
              <CarouselNext />
            </>
          )}
        </Carousel>
      )}

      <Separator className="my-4" />

      <div className="grid grid-cols-2 gap-3 text-sm mb-6">
        {t.grams && <div><span className="text-muted-foreground">Граммовка</span><p>{t.grams} г</p></div>}
        {t.temp_c && <div><span className="text-muted-foreground">Температура</span><p>{t.temp_c} °C</p></div>}
        {t.gear && <div><span className="text-muted-foreground">Посуда</span><p>{t.gear}</p></div>}
        {t.aroma_dry && <div><span className="text-muted-foreground">Аромат сухой</span><p>{t.aroma_dry}</p></div>}
        {t.aroma_warmed && <div><span className="text-muted-foreground">Аромат прогретый</span><p>{t.aroma_warmed}</p></div>}
        {t.effects_csv && <div><span className="text-muted-foreground">Ощущения</span><p>{t.effects_csv.replace(/,/g, ' · ')}</p></div>}
      </div>

      {t.summary && (
        <>
          <Separator className="my-4" />
          <div className="text-sm">
            <p className="text-muted-foreground mb-1">Заметка</p>
            <p>{t.summary}</p>
          </div>
        </>
      )}

      {t.infusions && t.infusions.length > 0 && (
        <>
          <Separator className="my-4" />
          <h2 className="text-base font-medium mb-3">Проливы</h2>
          <div className="flex flex-col gap-3">
            {t.infusions.map((inf: any) => (
              <Card key={inf.n}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Пролив #{inf.n}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm grid grid-cols-2 gap-2">
                  {inf.seconds && <div><span className="text-muted-foreground">Время</span><p>{inf.seconds} сек</p></div>}
                  {inf.liquor_color && <div><span className="text-muted-foreground">Цвет</span><p>{inf.liquor_color}</p></div>}
                  {inf.taste && <div><span className="text-muted-foreground">Вкус</span><p>{inf.taste}</p></div>}
                  {inf.body && <div><span className="text-muted-foreground">Тело</span><p>{inf.body}</p></div>}
                  {inf.aftertaste && <div><span className="text-muted-foreground">Послевкусие</span><p>{inf.aftertaste}</p></div>}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
