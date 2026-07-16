'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeftIcon, ImageSquareIcon, XIcon } from '@phosphor-icons/react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import RichCheckboxGroup, {
  emptyRichCheckboxState,
  richCheckboxToCsv,
  csvToRichCheckboxState,
  type RichCheckboxState,
} from '@/components/form/RichCheckboxGroup';
import RatingPicker from '@/components/form/RatingPicker';
import TeaCombobox from '@/components/form/TeaCombobox';
import TeawareCombobox from '@/components/form/TeawareCombobox';
import {
  createTasting,
  updateTasting,
  uploadTastingPhotos,
  deleteTastingPhoto,
  getTeaCollection,
  getTeawareCollection,
  type TeaItem,
  type Teaware,
} from '@/lib/apiClient';
import ConfirmDiscardDialog from '@/components/ConfirmDiscardDialog';
import { cn } from '@/lib/utils';
import { AROMA_OPTIONS, EFFECTS_OPTIONS } from '@/lib/constants';
import { ymGoal } from '@/lib/metrika';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { compressImage } from '@/lib/imageCompression';
import { AppButton } from '@/components/ui/app-button';
import { Spinner } from '@/components/ui/spinner';

/**
 * Быстрая заметка: сокращённая запись дегустации (entry_mode='quick').
 * Тот же Tasting, что и полная форма, но без проливов/даты/сценариев:
 * теги аромата/вкуса, ощущения, оценка, заметка, фото.
 * Маппинг как в quick-флоу бота: аромат → aroma_dry, вкус → aroma_warmed.
 */

// Превью выбранных тегов для свёрнутого заголовка аккордеона.
function tagsPreview(state: RichCheckboxState): string {
  const parts = [...state.selected];
  if (state.otherEnabled && state.other.trim()) parts.push(state.other.trim());
  return parts.join(', ');
}

// Данные quick-записи для предзаполнения (режим edit).
export type QuickNoteRecord = {
  name: string;
  grams: number | null;
  temp_c: number | null;
  aroma_dry: string | null;
  aroma_warmed: string | null;
  effects_csv: string | null;
  rating: number | null;
  summary: string | null;
  photos: { id: number; url: string }[];
};

type QuickNoteFormProps = {
  mode?: 'create' | 'edit';
  tastingId?: number;      // глобальный id — для API-вызовов
  tastingSeqNo?: number;   // персональный номер — для URL-переходов
  initialTeaItemId?: number | null;
  initialTeawareId?: number | null;
  record?: QuickNoteRecord;
};

// Снимок полей для «есть ли несохранённые изменения» в режиме edit.
function serializeQuickForm(v: {
  name: string;
  teaItemId: number | null;
  teawareId: number | null;
  grams: string;
  tempC: string;
  aroma: RichCheckboxState;
  taste: RichCheckboxState;
  effects: RichCheckboxState;
  rating: number;
  summary: string;
}): string {
  return JSON.stringify({ ...v, name: v.name.trim(), summary: v.summary.trim() });
}

export default function QuickNoteForm(props: QuickNoteFormProps = {}) {
  const { mode = 'create', tastingId, tastingSeqNo, initialTeaItemId, initialTeawareId, record } = props;
  const router = useRouter();
  const backHref = mode === 'edit' && tastingSeqNo ? `/tastings/${tastingSeqNo}` : '/';

  const [name, setName] = useState(record?.name ?? '');
  const [teaItem, setTeaItem] = useState<TeaItem | null>(null);
  const [teaware, setTeaware] = useState<Teaware | null>(null);
  const [grams, setGrams] = useState(record?.grams != null ? String(record.grams) : '');
  const [tempC, setTempC] = useState(record?.temp_c != null ? String(record.temp_c) : '');

  const [aroma, setAroma] = useState<RichCheckboxState>(
    () => csvToRichCheckboxState(record?.aroma_dry),
  );
  const [taste, setTaste] = useState<RichCheckboxState>(
    () => csvToRichCheckboxState(record?.aroma_warmed),
  );
  const [effects, setEffects] = useState<RichCheckboxState>(
    () => csvToRichCheckboxState(record?.effects_csv),
  );

  const [rating, setRating] = useState(record?.rating ?? 0);
  const [summary, setSummary] = useState(record?.summary ?? '');

  // Секции-аккордеоны (посуда/аромат/вкус/ощущения): все свёрнуты при
  // открытии формы, раскрыта максимум одна — «в фокусе всегда одна секция»
  // (решение из макетов). Секции в отдельных карточках, эксклюзивность
  // координируется этим общим состоянием.
  const [openSection, setOpenSection] = useState<string | null>(null);

  // Фото: уже загруженные (edit) удаляются на сервере при сохранении,
  // новые — догружаются (та же схема, что в полной форме).
  const [existingPhotos, setExistingPhotos] = useState(record?.photos ?? []);
  const [removedPhotoIds, setRemovedPhotoIds] = useState<number[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [photoCompressing, setPhotoCompressing] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const totalPhotos = existingPhotos.length + photos.length;

  const [submitting, setSubmitting] = useState(false);

  // Предзаполнение сорта/посуды по id из записи (режим edit) — как в полной
  // форме: грузим коллекцию и находим карточку, комбобокс показывает name.
  useEffect(() => {
    if (!initialTeaItemId) return;
    let cancelled = false;
    getTeaCollection(100, 0)
      .then((res) => {
        if (cancelled) return;
        const found = res.items.find((i) => i.id === initialTeaItemId);
        if (found) setTeaItem(found);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [initialTeaItemId]);

  useEffect(() => {
    if (!initialTeawareId) return;
    let cancelled = false;
    getTeawareCollection(100, 0)
      .then((res) => {
        if (cancelled) return;
        const found = res.items.find((i) => i.id === initialTeawareId);
        if (found) setTeaware(found);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [initialTeawareId]);

  const initialSnapshot = useRef<string>(
    mode === 'edit'
      ? serializeQuickForm({
          name: record?.name ?? '',
          teaItemId: initialTeaItemId ?? null,
          teawareId: initialTeawareId ?? null,
          grams: record?.grams != null ? String(record.grams) : '',
          tempC: record?.temp_c != null ? String(record.temp_c) : '',
          aroma: csvToRichCheckboxState(record?.aroma_dry),
          taste: csvToRichCheckboxState(record?.aroma_warmed),
          effects: csvToRichCheckboxState(record?.effects_csv),
          rating: record?.rating ?? 0,
          summary: record?.summary ?? '',
        })
      : '',
  );

  const currentSnapshot = serializeQuickForm({
    name,
    teaItemId: teaItem?.id ?? null,
    teawareId: teaware?.id ?? null,
    grams, tempC, aroma, taste, effects, rating, summary,
  });

  const isDirty = mode === 'edit'
    ? currentSnapshot !== initialSnapshot.current
      || photos.length > 0 || removedPhotoIds.length > 0
    : (name.trim().length > 0 || teaItem !== null || teaware !== null
        || grams !== '' || tempC !== ''
        || aroma.selected.length > 0 || aroma.other.trim() !== ''
        || taste.selected.length > 0 || taste.other.trim() !== ''
        || effects.selected.length > 0 || effects.other.trim() !== ''
        || rating > 0 || summary.trim() !== '' || photos.length > 0);
  const { confirmClose, discardDialogOpen, onConfirmDiscard, onCancelDiscard } = useUnsavedChanges(isDirty);

  async function handlePhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const room = 3 - totalPhotos;
    const slice = files.slice(0, room);
    if (photoInputRef.current) photoInputRef.current.value = '';
    if (slice.length === 0) return;

    setPhotoCompressing(true);
    try {
      const compressed = await Promise.all(slice.map(compressImage));
      compressed.forEach((f) => {
        const reader = new FileReader();
        reader.onload = () => setPhotoPreviews((prev) => [...prev, reader.result as string]);
        reader.readAsDataURL(f);
      });
      setPhotos((prev) => [...prev, ...compressed]);
    } finally {
      setPhotoCompressing(false);
    }
  }

  function removePhoto(idx: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== idx));
  }

  function removeExistingPhoto(id: number) {
    setExistingPhotos((prev) => prev.filter((p) => p.id !== id));
    setRemovedPhotoIds((prev) => [...prev, id]);
  }

  function buildPayload() {
    return {
      name: name.trim(),
      tea_item_id: teaItem?.id ?? null,
      teaware_id: teaware?.id ?? null,
      grams: grams ? Number(grams) : null,
      temp_c: tempC ? Number(tempC) : null,
      aroma_dry: richCheckboxToCsv(aroma) || null,
      aroma_warmed: richCheckboxToCsv(taste) || null,
      effects_csv: richCheckboxToCsv(effects) || null,
      rating,
      summary: summary.trim() || null,
      infusions: [],
    };
  }

  async function handleCreate() {
    const created = await createTasting({ ...buildPayload(), entry_mode: 'quick' });
    ymGoal('record_created_quick');
    if (photos.length > 0) {
      try {
        await uploadTastingPhotos(created.id, photos);
      } catch (e) {
        const err = e as { code?: string; message?: string };
        toast.error(err.code ? `Заметка сохранена, но фото не загрузилось: ${err.message}` : 'Заметка сохранена, но фото не загрузились');
      }
    }
    router.push(`/tastings/${created.seq_no}`);
  }

  async function handleEdit() {
    if (!tastingId) return;
    await updateTasting(tastingId, buildPayload());
    for (const id of removedPhotoIds) {
      try {
        await deleteTastingPhoto(tastingId, id);
      } catch {
        toast.error('Не удалось удалить одно из фото');
      }
    }
    if (photos.length > 0) {
      try {
        await uploadTastingPhotos(tastingId, photos);
      } catch (e) {
        const err = e as { code?: string; message?: string };
        toast.error(err.code ? `Изменения сохранены, но фото не загрузилось: ${err.message}` : 'Изменения сохранены, но новые фото не загрузились');
      }
    }
    initialSnapshot.current = currentSnapshot;
    router.push(`/tastings/${tastingSeqNo ?? tastingId}`);
    router.refresh();
  }

  async function handleSave() {
    if (!canSave) return;
    setSubmitting(true);
    try {
      if (mode === 'edit') await handleEdit();
      else await handleCreate();
    } catch (e) {
      const err = e as { status?: number };
      toast.error(
        err.status === 422
          ? 'Проверьте введённые значения и попробуйте ещё раз.'
          : 'Не удалось сохранить заметку. Проверьте подключение и попробуйте ещё раз.'
      );
      setSubmitting(false);
    }
  }

  // Чай обязателен только при создании: у quick-записей из бота привязки
  // к коллекции нет, и редактирование не должно её требовать.
  const canSave = name.trim().length > 0
    && (mode === 'edit' || teaItem !== null)
    && !submitting;

  const gearPreview = [
    teaware?.name,
    grams && `${grams} г`,
    tempC && `${tempC}°C`,
  ].filter(Boolean).join(' · ');

  return (
    <>
    <ConfirmDiscardDialog
      open={discardDialogOpen}
      onConfirm={onConfirmDiscard}
      onCancel={onCancelDiscard}
    />
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-32">
        <div className="flex items-center gap-3 mb-4">
          <button
            type="button"
            onClick={() => confirmClose(() => router.push(backHref))}
            className="w-9 h-9 rounded-full bg-button-icon-bg border border-button-icon-border flex items-center justify-center"
          >
            <ArrowLeftIcon size={16} className="text-foreground" />
          </button>
          <h1 className="text-[20px] font-semibold text-foreground">
            {mode === 'edit' ? 'Редактирование заметки' : 'Быстрая заметка'}
          </h1>
        </div>

        <div className="flex flex-col gap-4">
          <Field label="Название" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Дянь хун в гайвани"
            />
          </Field>

          <Field label="Выберите чай" required={mode === 'create'}>
            <TeaCombobox value={teaItem} onChange={setTeaItem} />
          </Field>

          <FormSection
            id="gear"
            title="Посуда • Вес • Температура"
            preview={gearPreview}
            openSection={openSection}
            onOpenChange={setOpenSection}
            // Нейтрализуем типографский отступ p из базового AccordionContent:
            // шторки выбора/добавления посуды рендерятся внутри этой секции,
            // и без этого их строки «разъезжаются».
            contentClassName="[&_p:not(:last-child)]:mb-0"
          >
            <div className="flex flex-col gap-3">
              <TeawareCombobox value={teaware} onChange={setTeaware} />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  inputMode="numeric"
                  value={grams}
                  onChange={(e) => setGrams(e.target.value.replace(/[^\d.]/g, ''))}
                  placeholder="Вес (гр)"
                />
                <Input
                  inputMode="numeric"
                  value={tempC}
                  onChange={(e) => setTempC(e.target.value.replace(/\D/g, ''))}
                  placeholder="Температура (°C)"
                />
              </div>
            </div>
          </FormSection>

          <FormSection
            id="aroma"
            title="Аромат"
            preview={tagsPreview(aroma)}
            openSection={openSection}
            onOpenChange={setOpenSection}
          >
            <RichCheckboxGroup
              options={AROMA_OPTIONS}
              value={aroma}
              onChange={setAroma}
            />
          </FormSection>

          <FormSection
            id="taste"
            title="Вкус"
            preview={tagsPreview(taste)}
            openSection={openSection}
            onOpenChange={setOpenSection}
          >
            <RichCheckboxGroup
              options={AROMA_OPTIONS}
              value={taste}
              onChange={setTaste}
            />
          </FormSection>

          <FormSection
            id="effects"
            title="Ощущения"
            preview={tagsPreview(effects)}
            openSection={openSection}
            onOpenChange={setOpenSection}
          >
            <RichCheckboxGroup
              options={EFFECTS_OPTIONS}
              value={effects}
              onChange={setEffects}
            />
          </FormSection>

          <Card>
            <div className="px-4 py-3 flex flex-col gap-3">
              <p className="text-[14px] font-medium text-foreground text-center">Оценка</p>
              <RatingPicker value={rating} onChange={setRating} />
            </div>
          </Card>

          <Textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Пара слов о впечатлении"
            className="min-h-24"
          />

          <div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handlePhotoPick}
            />
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={totalPhotos >= 3 || photoCompressing}
              className="w-full h-10 rounded-full bg-surface-input border border-border-input shadow-xs flex items-center justify-center gap-2 text-[14px] font-medium text-foreground outline-none transition-colors focus-visible:border-accent-default focus-visible:ring-[3px] focus-visible:ring-ring-focus disabled:opacity-50"
            >
              <ImageSquareIcon size={16} />
              {photoCompressing ? 'Обработка фото…' : 'Добавить фото (до 3 фото)'}
            </button>
            {(existingPhotos.length > 0 || photoPreviews.length > 0) && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {existingPhotos.map((p) => (
                  <div key={`exist-${p.id}`} className="relative w-[76px] h-[76px] rounded-xl overflow-hidden">
                    <Image src={p.url} alt="" fill className="object-cover" />
                    <button
                      type="button"
                      onClick={() => removeExistingPhoto(p.id)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-overlay-dialog flex items-center justify-center"
                    >
                      <XIcon size={12} weight="bold" className="text-text-light" />
                    </button>
                  </div>
                ))}
                {photoPreviews.map((src, idx) => (
                  <div key={`new-${idx}`} className="relative w-[76px] h-[76px] rounded-xl overflow-hidden">
                    <Image src={src} alt="" fill className="object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-overlay-dialog flex items-center justify-center"
                    >
                      <XIcon size={12} weight="bold" className="text-text-light" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border-default z-40">
        <div className="max-w-2xl mx-auto p-4 flex gap-2">
          <AppButton
            type="button"
            variant="secondary"
            onClick={() => confirmClose(() => router.push(backHref))}
            className="w-[120px] shrink-0"
          >
            Отменить
          </AppButton>
          <AppButton
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1"
          >
            {submitting
              ? (<><Spinner className="size-4" />Сохранение…</>)
              : (mode === 'edit' ? 'Сохранить изменения' : 'Сохранить')}
          </AppButton>
        </div>
      </div>
    </main>
    </>
  );
}

// Секция-аккордеон формы: отдельная карточка, в свёрнутом заголовке — превью
// выбранного (обрезается троеточием, чтобы стрелка не «убегала» за край).
// Эксклюзивность между секциями координирует родитель через openSection.
function FormSection({
  id,
  title,
  preview,
  openSection,
  onOpenChange,
  contentClassName,
  children,
}: {
  id: string;
  title: string;
  preview: string;
  openSection: string | null;
  onOpenChange: (section: string | null) => void;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  const isOpen = openSection === id;
  return (
    <Card>
      <Accordion
        className="w-full"
        multiple={false}
        value={isOpen ? [id] : []}
        onValueChange={(v: string[]) => onOpenChange(v.length > 0 ? id : null)}
      >
        <AccordionItem value={id} className="border-b-0">
          {/* min-w-0: триггер — flex-элемент, без этого длинное превью
              распирает его шире карточки и стрелка уезжает за край */}
          <AccordionTrigger className="min-w-0 px-4 py-3 hover:no-underline">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[16px] font-semibold text-foreground">{title}</span>
              {!isOpen && preview && (
                <span className="truncate text-[12px] font-normal text-text-secondary">
                  {preview}
                </span>
              )}
            </span>
          </AccordionTrigger>
          <AccordionContent className={cn('px-4 pb-4', contentClassName)}>
            {children}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[14px] font-medium text-foreground">
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-2xl shadow-xs overflow-hidden">{children}</div>
  );
}
