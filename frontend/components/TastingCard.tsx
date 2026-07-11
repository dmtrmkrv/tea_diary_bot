import Image from 'next/image';
import Link from 'next/link';
import { LeafIcon, StarIcon, LightningIcon } from '@phosphor-icons/react/dist/ssr';
import CategoryBadge from '@/components/CategoryBadge';
import { formatTastingDatetime } from '@/lib/datetime';

export interface TastingItem {
  id: number;
  seq_no: number;
  name: string;
  category: string;
  year: number | null;
  region: string | null;
  rating: number;
  entry_mode: string;
  created_at: string | null;
  cover_url: string | null;
  tea_item_id: number | null;
  tea_item_name: string | null;
  tea_item_category: string | null;
  tea_item_year: number | null;
  tea_item_region: string | null;
  tea_item_cover_url: string | null;
}

function TeaItemRow({ item }: { item: TastingItem }) {
  const meta = [
    item.tea_item_category,
    item.tea_item_year != null ? String(item.tea_item_year) : null,
    item.tea_item_region,
  ].filter(Boolean).join(' • ');

  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="w-8 h-8 shrink-0 rounded-md overflow-hidden bg-placeholder-tea-bg border border-placeholder-tea-border relative flex items-center justify-center">
        {item.tea_item_cover_url ? (
          <Image src={item.tea_item_cover_url} alt={item.tea_item_name ?? ''} fill className="object-cover" />
        ) : (
          <LeafIcon size={16} className="text-placeholder-tea-icon" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] leading-[16px] font-semibold text-foreground truncate">
          {item.tea_item_name}
        </p>
        {meta && (
          <p className="text-[12px] leading-[16px] text-muted-foreground truncate">{meta}</p>
        )}
      </div>
    </div>
  );
}

function BadgeRow({ item }: { item: TastingItem }) {
  if (!item.category && !item.year && !item.region) return null;
  return (
    <div className="flex flex-wrap gap-1 items-center">
      {item.category && <CategoryBadge category={item.category} />}
      {item.year != null && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-badge-tag-border bg-badge-tag-bg text-[12px] font-semibold leading-[16px] text-badge-tag-text">
          {item.year}
        </span>
      )}
      {item.region && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-badge-tag-border bg-badge-tag-bg text-[12px] font-semibold leading-[16px] text-badge-tag-text">
          {item.region}
        </span>
      )}
    </div>
  );
}

export default function TastingCard({ item, tzOffset = 0 }: { item: TastingItem; tzOffset?: number }) {
  const datetime = formatTastingDatetime(item.created_at, tzOffset);
  const isQuick = item.entry_mode === 'quick';
  const hasRating = item.rating > 0;
  const hasTeaItem = item.tea_item_id != null;

  return (
    <Link href={`/tastings/${item.id}`}>
      <article className="bg-card rounded-2xl overflow-hidden shadow-lg">
        {item.cover_url && (
          <div className="relative aspect-[2/1] w-full">
            <Image src={item.cover_url} alt={item.name} fill className="object-cover" />
          </div>
        )}

        <div className="flex flex-col gap-2 px-4 py-4">
          {(datetime || isQuick || hasRating) && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[12px] font-medium leading-[16px] whitespace-nowrap">
                {datetime}
              </span>
              <div className="flex items-center gap-1">
                {isQuick && (
                  <div className="flex items-center justify-center min-h-[20px] min-w-[20px] px-1 py-0.5 rounded-full border border-badge-rating-border text-badge-quick-text">
                    <LightningIcon size={16} weight="fill" />
                  </div>
                )}
                {hasRating && (
                  <div className="flex items-center gap-1 min-h-[20px] px-2 py-0.5 rounded-full border border-badge-rating-border text-badge-rating-text">
                    <StarIcon size={16} weight="fill" />
                    <span className="text-[12px] font-medium leading-[16px] whitespace-nowrap">
                      {item.rating}/10
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <p className="text-[16px] font-semibold leading-[24px] text-foreground">
            {item.name}
          </p>

          {hasTeaItem ? <TeaItemRow item={item} /> : <BadgeRow item={item} />}
        </div>
      </article>
    </Link>
  );
}
