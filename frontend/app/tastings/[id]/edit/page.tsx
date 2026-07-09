export const dynamic = 'force-dynamic';

import { unstable_rethrow } from 'next/navigation';
import { getTasting, getMe } from '@/lib/api';
import TastingForm, { type TastingFormRecord } from '@/components/TastingForm';
import QuickNoteForm, { type QuickNoteRecord } from '@/components/QuickNoteForm';

// Дата дегустации для поля формы (YYYY-MM-DD) с учётом часового пояса юзера.
// Полночь UTC — бэкдейт-маркер «только дата»: берём дату как есть, без сдвига.
function effectiveDateStr(createdAt: string | null, tzOffsetMin: number): string {
  if (!createdAt) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  const iso = createdAt.endsWith('Z') ? createdAt : createdAt + 'Z';
  const d = new Date(iso);
  const base = (d.getUTCHours() === 0 && d.getUTCMinutes() === 0)
    ? d
    : new Date(d.getTime() + tzOffsetMin * 60000);
  return `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, '0')}-${String(base.getUTCDate()).padStart(2, '0')}`;
}

export default async function EditTastingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tastingId = Number(id);
  const [t, me] = await Promise.all([
    getTasting(tastingId),
    getMe().catch((e) => { unstable_rethrow(e); return null; }) as Promise<{ tz_offset_min: number } | null>,
  ]);
  const tzOffset = me?.tz_offset_min ?? 0;

  // Быстрая заметка редактируется своей же формой, а не полной
  // (у quick другой смысл полей: aroma_dry = «аромат», aroma_warmed = «вкус»).
  if (t.entry_mode === 'quick') {
    const quickRecord: QuickNoteRecord = {
      name: t.name,
      grams: t.grams ?? null,
      temp_c: t.temp_c ?? null,
      aroma_dry: t.aroma_dry ?? null,
      aroma_warmed: t.aroma_warmed ?? null,
      effects_csv: t.effects_csv ?? null,
      rating: t.rating ?? 0,
      summary: t.summary ?? null,
      photos: t.photo_list ?? [],
    };
    return (
      <QuickNoteForm
        mode="edit"
        tastingId={tastingId}
        initialTeaItemId={t.tea_item_id ?? null}
        initialTeawareId={t.teaware_id ?? null}
        record={quickRecord}
      />
    );
  }

  const record: TastingFormRecord = {
    name: t.name,
    grams: t.grams ?? null,
    temp_c: t.temp_c ?? null,
    aroma_dry: t.aroma_dry ?? null,
    aroma_warmed: t.aroma_warmed ?? null,
    effects_csv: t.effects_csv ?? null,
    scenarios_csv: t.scenarios_csv ?? null,
    rating: t.rating ?? 0,
    summary: t.summary ?? null,
    infusions: t.infusions ?? [],
    photos: t.photo_list ?? [],
  };

  return (
    <TastingForm
      mode="edit"
      tastingId={tastingId}
      initialTeaItemId={t.tea_item_id ?? null}
      initialTeawareId={t.teaware_id ?? null}
      initialTastedDate={effectiveDateStr(t.created_at ?? null, tzOffset)}
      record={record}
    />
  );
}
