'use client';

import { useState } from 'react';
import {
  BowlSteamIcon,
  CaretDownIcon,
  CaretUpIcon,
  DropHalfBottomIcon,
  InfoIcon,
  MaskHappyIcon,
  StarIcon,
} from '@phosphor-icons/react';
import FlavorProfileEmptyIcon from '@/components/collection/FlavorProfileEmptyIcon';
import type { FlavorProfile, FlavorTag } from '@/lib/apiClient';

// Свёрнутый вид секции — первые N пиллов + «Показать ещё»
const COLLAPSED_COUNT = 4;

// Тег → класс палитры в globals.css («Tag Color Coding» из Фигмы).
// Теги без своего цвета (напр. «Мёд») получают нейтральный .flavor-pill.
const PILL_CLASS: Record<string, string> = {
  'Хлебный': 'flavor-pill-khlebnyy',
  'Кондитерский': 'flavor-pill-konditerskiy',
  'Ореховый': 'flavor-pill-orekhovyy',
  'Сухофрукты': 'flavor-pill-sukhofrukty',
  'Цветочный': 'flavor-pill-tsvetochnyy',
  'Ягодный': 'flavor-pill-yagodnyy',
  'Фруктовый': 'flavor-pill-fruktovyy',
  'Травянистый': 'flavor-pill-travyanistyy',
  'Овощной': 'flavor-pill-ovoshchnoy',
  'Пряный': 'flavor-pill-pryanyy',
  'Древесный': 'flavor-pill-drevesnyy',
  'Землистый': 'flavor-pill-zemlistyy',
  'Дымный': 'flavor-pill-dymnyy',
  'Минеральный': 'flavor-pill-mineralnyy',
  'Мёд': 'flavor-pill-myod',
};

function recordsLabel(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `Собрано из ${n} записи`;
  return `Собрано из ${n} записей`;
}

function TagPill({ tag, count }: FlavorTag) {
  return (
    <span
      className={`flavor-pill ${PILL_CLASS[tag] ?? ''} inline-flex items-center gap-2 border rounded-full pl-2.5 pr-1.5 py-1.5 text-[12px] leading-[16px] font-medium`}
    >
      {tag}
      <span className="bg-surface-elevated dark:bg-surface-sunken-strong rounded-full px-1.5 py-0.5 text-[12px] leading-[16px] font-medium text-foreground">
        ×{count}
      </span>
    </span>
  );
}

function TagGroup({
  icon,
  title,
  tags,
}: {
  icon: React.ReactNode;
  title: string;
  tags: FlavorTag[];
}) {
  const [expanded, setExpanded] = useState(false);
  if (tags.length === 0) return null;
  const visible = expanded ? tags : tags.slice(0, COLLAPSED_COUNT);
  const hasMore = tags.length > COLLAPSED_COUNT;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-[14px] leading-[20px] font-semibold text-foreground">{title}</p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {visible.map((t) => (
          <TagPill key={t.tag} tag={t.tag} count={t.count} />
        ))}
      </div>
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="self-start flex items-center gap-1 py-1 text-[12px] leading-[16px] font-medium text-accent-default"
        >
          {expanded ? 'Свернуть' : 'Показать еще'}
          {expanded ? <CaretUpIcon size={16} /> : <CaretDownIcon size={16} />}
        </button>
      )}
    </div>
  );
}

export default function FlavorProfileSection({
  profile,
  loading,
}: {
  profile: FlavorProfile | null;
  loading: boolean;
}) {
  const hasTags =
    profile != null &&
    (profile.aroma.length > 0 || profile.taste.length > 0 || profile.effects.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <h3 className="text-[18px] leading-[24px] font-semibold text-foreground">
            Вкусовой профиль
          </h3>
          <div className="flex items-center gap-1.5">
            <StarIcon size={24} weight="fill" className="text-badge-rating-border" />
            <p className="text-[18px] leading-[24px] font-semibold text-foreground">
              {profile?.avg_rating != null
                ? String(profile.avg_rating).replace('.', ',')
                : '–'}
            </p>
          </div>
        </div>
        <div className="flex items-start justify-between text-[12px] leading-[16px] text-muted-foreground">
          <p>
            {profile == null
              ? ' '
              : profile.records_used > 0
                ? recordsLabel(profile.records_used)
                : 'Записей пока нет'}
          </p>
          <p>Средний рейтинг</p>
        </div>
      </div>

      {loading ? (
        <p className="text-[14px] text-muted-foreground">Загрузка…</p>
      ) : hasTags ? (
        <>
          <TagGroup
            icon={<BowlSteamIcon size={24} className="text-accent-default" />}
            title="Аромат"
            tags={profile!.aroma}
          />
          {profile!.aroma.length > 0 && profile!.taste.length > 0 && (
            <div className="h-px bg-border-input" />
          )}
          <TagGroup
            icon={<DropHalfBottomIcon size={24} className="text-accent-default" />}
            title="Вкус"
            tags={profile!.taste}
          />
          {profile!.effects.length > 0 &&
            (profile!.aroma.length > 0 || profile!.taste.length > 0) && (
              <div className="h-px bg-border-input" />
            )}
          <TagGroup
            icon={<MaskHappyIcon size={24} className="text-accent-default" />}
            title="Ощущения"
            tags={profile!.effects}
          />
          <div className="flex items-start gap-2">
            <InfoIcon size={24} className="text-muted-foreground shrink-0" />
            <p className="text-[10px] leading-[16px] font-medium text-muted-foreground">
              Вкусовой профиль обновляется после каждой заметки или дегустации по сорту.
            </p>
          </div>
        </>
      ) : (
        <div className="bg-surface-input border border-border-default rounded-2xl py-4 px-4 flex flex-col items-center gap-4">
          <FlavorProfileEmptyIcon />
          <div className="flex flex-col gap-1 text-center">
            <p className="text-[16px] leading-[24px] font-semibold text-text-secondary">
              Здесь появится вкусовой профиль
            </p>
            <p className="text-[12px] leading-[16px] text-muted-foreground">
              Он собирается из ароматов, вкусов и ощущений в ваших дегустациях.
              Чем больше записей, тем точнее профиль.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
