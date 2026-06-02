export const dynamic = 'force-dynamic';

import Link from 'next/link';
import {
  ArrowLeftIcon,
  ScalesIcon,
  ThermometerIcon,
  LeafIcon,
  BowlSteamIcon,
  DropHalfBottomIcon,
  CaretRightIcon,
  StarIcon,
  LightningIcon,
} from '@phosphor-icons/react/dist/ssr';
import { getTasting } from '@/lib/api';
import CategoryBadge from '@/components/CategoryBadge';
import NotesSection from '@/components/NotesSection';
import InfusionsAccordion from '@/components/InfusionsAccordion';
import TastingActions from '@/components/TastingActions';
import PhotoCarousel from '@/components/PhotoCarousel';
import TeaItemTrigger from '@/components/collection/TeaItemTrigger';

function formatDatetime(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const date = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(d);
  const h = d.getUTCHours(), m = d.getUTCMinutes();
  if (h === 0 && m === 0) return date;
  return `${date}, ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function DataRow({
  icon,
  label,
  value,
  wide,
  border,
  rightBorder,
  amber,
  extra,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  wide?: boolean;
  border?: boolean;
  rightBorder?: boolean;
  amber?: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <div className={[
      'flex gap-2 items-start pb-2',
      wide ? 'col-span-2' : '',
      border ? 'border-t border-[#e7e5e4] pt-4' : '',
      rightBorder ? 'border-r border-[#e7e5e4]' : '',
    ].join(' ')}>
      <span className="shrink-0 text-[#a8a29e] mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0 flex items-start gap-1">
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-medium leading-[16px] text-[#a8a29e] whitespace-nowrap">{label}</p>
          <p className={`text-[14px] leading-[20px] ${amber ? 'text-[#d97706]' : 'text-[#1c1917]'}`}>{value}</p>
        </div>
        {extra}
      </div>
    </div>
  );
}

export default async function TastingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTasting(Number(id));

  const datetime = formatDatetime(t.created_at ?? null);
  const effects = t.effects_csv ? t.effects_csv.split(',').map((s: string) => s.trim()).join(' · ') : null;

  return (
    <main className="min-h-screen bg-[#e7e5e4]">
      <div className="flex flex-col gap-5 px-4 pt-12">

        {/* Header buttons */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="bg-[#f5f5f5] flex items-center justify-center h-9 w-9 rounded-full text-[#78716c]"
          >
            <ArrowLeftIcon size={16} />
          </Link>
          <TastingActions tastingId={t.id} />
        </div>

        {/* Title group */}
        <div className="flex flex-col gap-2">
          {/* Date + rating/quick badges */}
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-medium leading-[16px] text-[#78716c]">
              {datetime}
            </p>
            <div className="flex gap-1 items-center">
              {t.entry_mode === 'quick' && (
                <span className="border border-[#f59e0b] rounded-full px-1 py-0.5 flex items-center justify-center min-w-[20px] min-h-[20px]">
                  <LightningIcon size={16} className="text-[#f59e0b]" />
                </span>
              )}
              {t.rating != null && (
                <span className="border border-[#f59e0b] rounded-full px-2 py-0.5 flex items-center gap-1 min-h-[20px]">
                  <StarIcon size={16} className="text-[#f59e0b]" />
                  <span className="text-[12px] font-medium text-[#f59e0b] leading-[16px]">{t.rating}/10</span>
                </span>
              )}
            </div>
          </div>

          {/* Title */}
          <h1 className="text-[24px] font-semibold leading-[1.2] tracking-[-1px] text-[#292524]">
            {t.name}
          </h1>

          {/* Badges — скрываем если привязан сорт из коллекции (там уже есть тип/год/регион) */}
          {!t.tea_item_name && (
            <div className="flex flex-wrap gap-1">
              {t.category && <CategoryBadge category={t.category} />}
              {t.year && (
                <span className="border border-[#d4d4d4] bg-[rgba(255,255,255,0.5)] rounded-full px-2 py-0.5 text-[12px] font-semibold leading-[16px] text-[#0a0a0a]">
                  {t.year}
                </span>
              )}
              {t.region && (
                <span className="border border-[#d4d4d4] bg-[rgba(255,255,255,0.5)] rounded-full px-2 py-0.5 text-[12px] font-semibold leading-[16px] text-[#0a0a0a]">
                  {t.region}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Image carousel */}
      {t.photo_urls && t.photo_urls.length > 0 && (
        <div className="px-4 mt-5">
          <PhotoCarousel urls={t.photo_urls} alt={t.name} />
        </div>
      )}

      {/* Main data card + infusions */}
      <div className="flex flex-col gap-4 px-4 mt-5 pb-8">

        {/* Main data card */}
        <div className="bg-white rounded-2xl shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] p-4 grid grid-cols-2 gap-x-2 gap-y-2">

          {/* Tea item row — кликабельная, открывает TeaItemSheet */}
          {t.tea_item_name && t.tea_item_id && (
            <TeaItemTrigger item={{
              id: t.tea_item_id,
              name: t.tea_item_name,
              category: t.tea_item_category ?? null,
              year: t.tea_item_year ?? null,
              region: t.tea_item_region ?? null,
              cover_url: t.tea_item_cover_url ?? null,
              notes: null,
              vendor: null,
              tasting_count: 0,
              created_at: '',
            }} />
          )}

          <DataRow
            icon={<ScalesIcon size={24} />}
            label="Граммовка"
            value={t.grams != null ? `${t.grams} гр` : null}
            rightBorder
          />
          <DataRow
            icon={<ThermometerIcon size={24} />}
            label="Температура"
            value={t.temp_c != null ? `${t.temp_c} °C` : null}
          />
          {t.gear && (
            <DataRow
              icon={<DropHalfBottomIcon size={24} />}
              label="Посуда"
              value={t.gear}
              wide
              border
              amber
              extra={<CaretRightIcon size={24} className="text-[#a8a29e] shrink-0 mt-0.5" />}
            />
          )}
          {t.aroma_dry && (
            <DataRow
              icon={<LeafIcon size={24} />}
              label="Аромат сухого листа"
              value={t.aroma_dry}
              wide
              border
            />
          )}
          {t.aroma_warmed && (
            <DataRow
              icon={<BowlSteamIcon size={24} />}
              label="Аромат прогретого/промытого листа"
              value={t.aroma_warmed}
              wide
              border
            />
          )}
          {effects && (
            <DataRow
              icon={<DropHalfBottomIcon size={24} />}
              label="Ощущения"
              value={effects}
              wide
              border
            />
          )}

          {/* Notes row */}
          {t.summary && (
            <div className="col-span-2 border-t border-[#e7e5e4] pt-4 flex gap-2 items-start">
              <span className="shrink-0 text-[#a8a29e] mt-0.5">
                <DropHalfBottomIcon size={24} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium leading-[16px] text-[#a8a29e] mb-0.5">Заметка</p>
                <NotesSection text={t.summary} />
              </div>
            </div>
          )}
        </div>

        {/* Infusions */}
        {t.infusions && t.infusions.length > 0 && (
          <InfusionsAccordion infusions={t.infusions} />
        )}
      </div>
    </main>
  );
}
