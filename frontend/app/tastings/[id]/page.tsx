export const dynamic = 'force-dynamic';

import Link from 'next/link';
import {
  ArrowLeftIcon,
  ScalesIcon,
  ThermometerIcon,
  PlantIcon,
  BowlSteamIcon,
  DropHalfBottomIcon,
  MaskHappyIcon,
  NotePencilIcon,
  CaretRightIcon,
  StarIcon,
  LightningIcon,
  CompassIcon,
} from '@phosphor-icons/react/dist/ssr';
import { unstable_rethrow } from 'next/navigation';
import { getTasting, getMe } from '@/lib/api';
import CategoryBadge from '@/components/CategoryBadge';
import NotesSection from '@/components/NotesSection';
import InfusionsAccordion from '@/components/InfusionsAccordion';
import TastingActions from '@/components/TastingActions';
import TastingHero from '@/components/TastingHero';
import TeaItemTrigger from '@/components/collection/TeaItemTrigger';
import TeawareItemTrigger from '@/components/collection/TeawareItemTrigger';
import { formatTastingDatetime } from '@/lib/datetime';

// Теги-CSV (Ощущения/Сценарии): предопределённые пункты разделяем « · »,
// а свободный текст «Другое: …» показываем как есть — его запятые это не
// разделители, а часть текста. Маркер «Другое:» форма всегда ставит последним
// элементом (richCheckboxToCsv), поэтому граница определяется надёжно.
function formatTagsCsv(csv: string | null | undefined): string | null {
  if (!csv) return null;
  const parts = csv.split(',').map((s) => s.trim()).filter(Boolean);
  const otherIdx = parts.findIndex((p) => p.startsWith('Другое:'));
  if (otherIdx === -1) return parts.join(' · ');
  const tags = parts.slice(0, otherIdx);
  const other = parts.slice(otherIdx).join(', ');
  return [...tags, other].join(' · ');
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
      border ? 'border-t border-border-default pt-4' : '',
      rightBorder ? 'border-r border-border-default' : '',
    ].join(' ')}>
      <span className="shrink-0 text-muted-foreground mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0 flex items-start gap-1">
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-medium leading-[16px] text-muted-foreground whitespace-nowrap">{label}</p>
          <p className={`text-[14px] leading-[20px] ${amber ? 'text-accent-muted' : 'text-foreground'}`}>{value}</p>
        </div>
        {extra}
      </div>
    </div>
  );
}

export default async function TastingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [t, me] = await Promise.all([
    getTasting(Number(id)),
    getMe().catch((e) => { unstable_rethrow(e); return null; }) as Promise<{ tz_offset_min: number } | null>,
  ]);
  const tzOffset = me?.tz_offset_min ?? 0;

  const datetime = formatTastingDatetime(t.created_at ?? null, tzOffset);
  const hasPhoto = Boolean(t.photo_urls && t.photo_urls.length > 0);
  const effects = formatTagsCsv(t.effects_csv);
  const scenarios = formatTagsCsv(t.scenarios_csv);

  return (
    <main className="min-h-screen bg-background">
      {hasPhoto ? (
        /* С фото: hero — фото-фон + overlay (кнопки, дата/рейтинг/заголовок, бейджи) */
        <div className="max-w-2xl mx-auto sm:px-4">
          <TastingHero
            id={t.id}
            photos={t.photo_urls}
            name={t.name}
            datetime={datetime}
            rating={t.rating ?? null}
            isQuick={t.entry_mode === 'quick'}
            category={!t.tea_item_name ? t.category : null}
            year={!t.tea_item_name ? t.year : null}
            region={!t.tea_item_name ? t.region : null}
          />
        </div>
      ) : (
        /* Без фото: обычная шапка + заголовок */
        <div className="max-w-2xl mx-auto flex flex-col gap-5 px-4 pt-12">

          {/* Header buttons */}
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="bg-button-icon-bg border border-button-icon-border flex items-center justify-center h-9 w-9 rounded-full text-foreground"
            >
              <ArrowLeftIcon size={16} />
            </Link>
            <TastingActions tastingId={t.id} />
          </div>

          {/* Title group */}
          <div className="flex flex-col gap-2">
            {/* Date + rating/quick badges */}
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-medium leading-[16px] text-muted-foreground">
                {datetime}
              </p>
              <div className="flex gap-1 items-center">
                {t.entry_mode === 'quick' && (
                  <span className="border border-badge-rating-border rounded-full px-1 py-0.5 flex items-center justify-center min-w-[20px] min-h-[20px]">
                    <LightningIcon size={16} weight="fill" className="text-badge-quick-text" />
                  </span>
                )}
                {t.rating != null && (
                  <span className="border border-badge-rating-border rounded-full px-2 py-0.5 flex items-center gap-1 min-h-[20px]">
                    <StarIcon size={16} weight="fill" className="text-badge-rating-text" />
                    <span className="text-[12px] font-medium text-badge-rating-text leading-[16px]">{t.rating}/10</span>
                  </span>
                )}
              </div>
            </div>

            {/* Title */}
            <h1 className="text-[24px] font-semibold leading-[1.2] tracking-[-1px] text-foreground">
              {t.name}
            </h1>

            {/* Badges — скрываем если привязан сорт из коллекции (там уже есть тип/год/регион) */}
            {!t.tea_item_name && (
              <div className="flex flex-wrap gap-1">
                {t.category && <CategoryBadge category={t.category} />}
                {t.year && (
                  <span className="border border-badge-tag-border bg-badge-tag-bg rounded-full px-2 py-0.5 text-[12px] font-semibold leading-[16px] text-badge-tag-text">
                    {t.year}
                  </span>
                )}
                {t.region && (
                  <span className="border border-badge-tag-border bg-badge-tag-bg rounded-full px-2 py-0.5 text-[12px] font-semibold leading-[16px] text-badge-tag-text">
                    {t.region}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main data card + infusions */}
      <div className="max-w-2xl mx-auto flex flex-col gap-4 px-4 mt-5 pb-8">

        {/* Main data card */}
        <div className="bg-card rounded-2xl shadow-md p-4 grid grid-cols-2 gap-x-2 gap-y-2">

          {/* Tea item row — кликабельная, открывает TeaDetailSheet */}
          {t.tea_item_name && t.tea_item_id && (
            <TeaItemTrigger item={{
              id: t.tea_item_id,
              name: t.tea_item_name,
              category: t.tea_item_category ?? null,
              year: t.tea_item_year ?? null,
              region: t.tea_item_region ?? null,
              cover_url: t.tea_item_cover_url ?? null,
              notes: t.tea_item_notes ?? null,
              vendor: null,
              amount_g: t.tea_item_amount_g ?? null,
              is_favorite: false,
              tasting_count: 0,
              avg_rating: null,
              created_at: '',
            }} />
          )}

          {/* Teaware row — кликабельная, открывает TeawareItemSheet */}
          {t.teaware_name && t.teaware_id && (
            <TeawareItemTrigger item={{
              id: t.teaware_id,
              name: t.teaware_name,
              type: t.teaware_type ?? null,
              volume_ml: t.teaware_volume_ml ?? null,
              material: t.teaware_material ?? null,
              region: t.teaware_region ?? null,
              suitable_csv: null,
              notes: t.teaware_notes ?? null,
              cover_url: t.teaware_cover_url ?? null,
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
          {/* Legacy gear — текстовое поле от Telegram-бота, показываем только
              если нет структурной посуды (teaware) */}
          {!t.teaware_name && t.gear && (
            <DataRow
              icon={<DropHalfBottomIcon size={24} />}
              label="Посуда"
              value={t.gear}
              wide
              border
              amber
              extra={<CaretRightIcon size={24} className="text-muted-foreground shrink-0 mt-0.5" />}
            />
          )}
          {/* У quick-записей (бот и веб) в aroma_dry лежит просто «аромат»,
              а в aroma_warmed — «вкус» (исторический маппинг из бота). */}
          {t.aroma_dry && (
            <DataRow
              icon={<PlantIcon size={24} />}
              label={t.entry_mode === 'quick' ? 'Аромат' : 'Аромат сухого листа'}
              value={t.aroma_dry}
              wide
              border
            />
          )}
          {t.aroma_warmed && (
            <DataRow
              icon={<BowlSteamIcon size={24} />}
              label={t.entry_mode === 'quick' ? 'Вкус' : 'Аромат прогретого/промытого листа'}
              value={t.aroma_warmed}
              wide
              border
            />
          )}
          {effects && (
            <DataRow
              icon={<MaskHappyIcon size={24} />}
              label="Ощущения"
              value={effects}
              wide
              border
            />
          )}
          {scenarios && (
            <DataRow
              icon={<CompassIcon size={24} />}
              label="Сценарии"
              value={scenarios}
              wide
              border
            />
          )}

          {/* Notes row */}
          {t.summary && (
            <div className="col-span-2 border-t border-border-default pt-4 flex gap-2 items-start">
              <span className="shrink-0 text-muted-foreground mt-0.5">
                <NotePencilIcon size={24} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium leading-[16px] text-muted-foreground mb-0.5">Заметка</p>
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
