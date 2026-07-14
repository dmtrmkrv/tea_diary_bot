'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeftIcon,
  CaretDownIcon,
  PlusIcon,
  TrashIcon,
  ImageSquareIcon,
  XIcon,
} from '@phosphor-icons/react';
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
import RichRadioGroup from '@/components/form/RichRadioGroup';
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
import { AROMA_OPTIONS, EFFECTS_OPTIONS } from '@/lib/constants';
import { ymGoal } from '@/lib/metrika';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { compressImage } from '@/lib/imageCompression';
import { AppButton } from '@/components/ui/app-button';
import { Spinner } from '@/components/ui/spinner';

const TASTE_OPTIONS = AROMA_OPTIONS;

const AFTERTASTE_OPTIONS = [
  'Сладкое', 'Кислое', 'Горькое', 'Пряное',
  'Кондитерское', 'Ореховое', 'Цветочное', 'Фруктовое',
  'Овощное', 'Травянистое', 'Древесное', 'Землистое',
  'Дымное', 'Минеральное',
];

const BODY_OPTIONS = ['Тонкое', 'Лёгкое', 'Среднее', 'Плотное', 'Маслянистое'];

const SCENARIOS_OPTIONS = ['Отдых', 'Работа/учеба', 'Творчество', 'Медитация', 'Общение', 'Прогулка'];

type Infusion = {
  uid: number;
  open: boolean;
  seconds: string;
  liquor_color: string;
  taste: RichCheckboxState;
  special_notes: string;
  body: string | null;
  aftertaste: RichCheckboxState;
  note: string;
};

function newInfusion(uid: number): Infusion {
  return {
    uid,
    open: true,
    seconds: '',
    liquor_color: '',
    taste: { ...emptyRichCheckboxState },
    special_notes: '',
    body: null,
    aftertaste: { ...emptyRichCheckboxState },
    note: '',
  };
}

// Сырой пролив из детального ответа API (для предзаполнения при редактировании).
type RecordInfusion = {
  n: number;
  seconds: number | null;
  liquor_color: string | null;
  taste: string | null;
  special_notes: string | null;
  body: string | null;
  aftertaste: string | null;
  note: string | null;
};

export type TastingFormRecord = {
  name: string;
  grams: number | null;
  temp_c: number | null;
  aroma_dry: string | null;
  aroma_warmed: string | null;
  effects_csv: string | null;
  scenarios_csv: string | null;
  rating: number | null;
  summary: string | null;
  infusions: RecordInfusion[];
  photos: { id: number; url: string }[];
};

type TastingFormProps = {
  mode: 'create' | 'edit';
  tastingId?: number;
  initialTeaItemId?: number | null;
  initialTeawareId?: number | null;
  initialTastedDate?: string;   // YYYY-MM-DD (режим edit; считается с учётом TZ юзера)
  record?: TastingFormRecord;   // данные записи для предзаполнения (режим edit)
};

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function recordInfusionToState(inf: RecordInfusion, uid: number): Infusion {
  return {
    uid,
    open: false,
    seconds: inf.seconds != null ? String(inf.seconds) : '',
    liquor_color: inf.liquor_color ?? '',
    taste: csvToRichCheckboxState(inf.taste),
    special_notes: inf.special_notes ?? '',
    body: inf.body ?? null,
    aftertaste: csvToRichCheckboxState(inf.aftertaste),
    note: inf.note ?? '',
  };
}

// Стабильный «снимок» полей формы — для определения «есть ли несохранённые
// изменения» в режиме редактирования (сравниваем текущее с исходным).
function serializeForm(v: {
  name: string;
  tastedDate: string;
  teaItemId: number | null;
  teawareId: number | null;
  grams: string;
  tempC: string;
  aromaDry: RichCheckboxState;
  aromaWarmed: RichCheckboxState;
  effects: RichCheckboxState;
  scenarios: RichCheckboxState;
  rating: number;
  summary: string;
  infusions: Infusion[];
}): string {
  return JSON.stringify({
    name: v.name.trim(),
    tastedDate: v.tastedDate,
    teaItemId: v.teaItemId,
    teawareId: v.teawareId,
    grams: v.grams,
    tempC: v.tempC,
    aromaDry: v.aromaDry,
    aromaWarmed: v.aromaWarmed,
    effects: v.effects,
    scenarios: v.scenarios,
    rating: v.rating,
    summary: v.summary.trim(),
    infusions: v.infusions.map((i) => ({
      seconds: i.seconds,
      liquor_color: i.liquor_color,
      taste: i.taste,
      special_notes: i.special_notes,
      body: i.body,
      aftertaste: i.aftertaste,
      note: i.note,
    })),
  });
}

export default function TastingForm(props: TastingFormProps) {
  const { mode, tastingId, initialTeaItemId, initialTeawareId, record } = props;
  const router = useRouter();
  const backHref = mode === 'edit' && tastingId ? `/tastings/${tastingId}` : '/';

  const [name, setName] = useState(record?.name ?? '');
  const [tastedDate, setTastedDate] = useState(() => props.initialTastedDate ?? todayStr());
  const [teaItem, setTeaItem] = useState<TeaItem | null>(null);
  const [teaware, setTeaware] = useState<Teaware | null>(null);
  const [grams, setGrams] = useState(record?.grams != null ? String(record.grams) : '');
  const [tempC, setTempC] = useState(record?.temp_c != null ? String(record.temp_c) : '');

  const [aromaDry, setAromaDry] = useState<RichCheckboxState>(
    () => csvToRichCheckboxState(record?.aroma_dry),
  );
  const [aromaWarmed, setAromaWarmed] = useState<RichCheckboxState>(
    () => csvToRichCheckboxState(record?.aroma_warmed),
  );

  const [infusions, setInfusions] = useState<Infusion[]>(
    () => (record?.infusions ?? []).map((inf, idx) => recordInfusionToState(inf, idx + 1)),
  );
  const nextInfusionUid = useRef((record?.infusions?.length ?? 0) + 1);

  const [effects, setEffects] = useState<RichCheckboxState>(
    () => csvToRichCheckboxState(record?.effects_csv),
  );
  const [scenarios, setScenarios] = useState<RichCheckboxState>(
    () => csvToRichCheckboxState(record?.scenarios_csv),
  );

  const [rating, setRating] = useState(record?.rating ?? 0);
  const [summary, setSummary] = useState(record?.summary ?? '');

  // Фото: уже загруженные (edit) — удаляются на сервере при сохранении;
  // новые — догружаются. Удаление существующих откладываем до «Сохранить».
  const [existingPhotos, setExistingPhotos] = useState(record?.photos ?? []);
  const [removedPhotoIds, setRemovedPhotoIds] = useState<number[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [photoCompressing, setPhotoCompressing] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const totalPhotos = existingPhotos.length + photos.length;

  const [submitting, setSubmitting] = useState(false);

  // Несохранённые изменения. В create — по непустоте полей (как было).
  // В edit — сравнение снимка формы с исходным + правки фото.
  const initialSnapshot = useRef<string>(
    mode === 'edit'
      ? serializeForm({
          name: record?.name ?? '',
          tastedDate: props.initialTastedDate ?? todayStr(),
          teaItemId: initialTeaItemId ?? null,
          teawareId: initialTeawareId ?? null,
          grams: record?.grams != null ? String(record.grams) : '',
          tempC: record?.temp_c != null ? String(record.temp_c) : '',
          aromaDry: csvToRichCheckboxState(record?.aroma_dry),
          aromaWarmed: csvToRichCheckboxState(record?.aroma_warmed),
          effects: csvToRichCheckboxState(record?.effects_csv),
          scenarios: csvToRichCheckboxState(record?.scenarios_csv),
          rating: record?.rating ?? 0,
          summary: record?.summary ?? '',
          infusions: (record?.infusions ?? []).map((inf, idx) => recordInfusionToState(inf, idx + 1)),
        })
      : '',
  );

  const currentSnapshot = serializeForm({
    name, tastedDate,
    teaItemId: teaItem?.id ?? null,
    teawareId: teaware?.id ?? null,
    grams, tempC, aromaDry, aromaWarmed, effects, scenarios, rating, summary, infusions,
  });

  const isDirty = mode === 'edit'
    ? currentSnapshot !== initialSnapshot.current
      || photos.length > 0 || removedPhotoIds.length > 0
    : (name.trim().length > 0 || teaItem !== null || teaware !== null
        || grams !== '' || tempC !== '' || infusions.length > 0
        || rating > 0 || summary.trim() !== '' || photos.length > 0);
  const { confirmClose, discardDialogOpen, onConfirmDiscard, onCancelDiscard } = useUnsavedChanges(isDirty);

  const lastInfusionRef = useRef<HTMLDivElement | null>(null);
  const prevInfusionCount = useRef(infusions.length);

  useEffect(() => {
    if (infusions.length > prevInfusionCount.current) {
      lastInfusionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    prevInfusionCount.current = infusions.length;
  }, [infusions.length]);

  // Предзаполнение сорта/посуды по id: грузим карточку из коллекции (для create —
  // из query-параметров, для edit — из самой записи). Combobox показывает name.
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

  function addInfusion() {
    const uid = nextInfusionUid.current++;
    setInfusions((prev) => [
      ...prev.map((i) => ({ ...i, open: false })),
      newInfusion(uid),
    ]);
  }

  function removeInfusion(uid: number) {
    setInfusions((prev) => prev.filter((i) => i.uid !== uid));
  }

  function updateInfusion(uid: number, patch: Partial<Infusion>) {
    setInfusions((prev) => prev.map((i) => (i.uid === uid ? { ...i, ...patch } : i)));
  }

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
      tasted_date: tastedDate || null,
      tea_item_id: teaItem?.id ?? null,
      teaware_id: teaware?.id ?? null,
      grams: grams ? Number(grams) : null,
      temp_c: tempC ? Number(tempC) : null,
      aroma_dry: richCheckboxToCsv(aromaDry) || null,
      aroma_warmed: richCheckboxToCsv(aromaWarmed) || null,
      effects_csv: richCheckboxToCsv(effects) || null,
      scenarios_csv: richCheckboxToCsv(scenarios) || null,
      rating,
      summary: summary.trim() || null,
      infusions: infusions.map((inf, idx) => ({
        n: idx + 1,
        seconds: inf.seconds ? Number(inf.seconds) : null,
        liquor_color: inf.liquor_color.trim() || null,
        taste: richCheckboxToCsv(inf.taste) || null,
        special_notes: inf.special_notes.trim() || null,
        body: inf.body,
        aftertaste: richCheckboxToCsv(inf.aftertaste) || null,
        note: inf.note.trim() || null,
      })),
    };
  }

  async function handleCreate() {
    const created = await createTasting({ ...buildPayload(), entry_mode: 'web' });
    ymGoal('record_created_full');
    if (photos.length > 0) {
      try {
        await uploadTastingPhotos(created.id, photos);
      } catch (e) {
        const err = e as { code?: string; message?: string };
        toast.error(err.code ? `Дегустация сохранена, но фото не загрузилось: ${err.message}` : 'Дегустация сохранена, но фото не загрузились');
      }
    }
    router.push(`/tastings/${created.id}`);
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
    router.push(`/tastings/${tastingId}`);
    router.refresh();
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      if (mode === 'edit') await handleEdit();
      else await handleCreate();
    } catch (e) {
      const err = e as { status?: number };
      toast.error(
        err.status === 422
          ? 'Проверьте введённые значения и попробуйте ещё раз.'
          : 'Не удалось сохранить дегустацию. Проверьте подключение и попробуйте ещё раз.'
      );
      setSubmitting(false);
    }
  }

  const canSave = name.trim().length > 0 && !submitting;
  const title = mode === 'edit' ? 'Редактирование' : 'Новая дегустация';

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
          <h1 className="text-[20px] font-semibold text-foreground">{title}</h1>
        </div>

        <div className="flex flex-col gap-4">
          <Field label="Название дегустации" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Дянь хун в гайвани"
            />
          </Field>

          <Field label="Дата дегустации">
            <Input
              type="date"
              value={tastedDate}
              onChange={(e) => setTastedDate(e.target.value)}
            />
          </Field>

          <Field label="Выберите чай" required>
            <TeaCombobox value={teaItem} onChange={setTeaItem} />
          </Field>

          <Field label="Выберите посуду">
            <TeawareCombobox value={teaware} onChange={setTeaware} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Вес (гр)">
              <Input
                inputMode="numeric"
                value={grams}
                onChange={(e) => setGrams(e.target.value.replace(/[^\d.]/g, ''))}
                placeholder="5"
              />
            </Field>
            <Field label="Температура (°C)">
              <Input
                inputMode="numeric"
                value={tempC}
                onChange={(e) => setTempC(e.target.value.replace(/\D/g, ''))}
                placeholder="90"
              />
            </Field>
          </div>

          <Card>
            <Accordion className="w-full">
              <AccordionItem value="aroma-dry" className="border-b last:border-b-0">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  Аромат сухого листа
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <RichCheckboxGroup
                    options={AROMA_OPTIONS}
                    value={aromaDry}
                    onChange={setAromaDry}
                  />
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="aroma-warmed" className="border-b-0">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  Аромат прогретого/промытого листа
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <RichCheckboxGroup
                    options={AROMA_OPTIONS}
                    value={aromaWarmed}
                    onChange={setAromaWarmed}
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>

          {infusions.map((inf, idx) => (
            <div key={inf.uid} ref={idx === infusions.length - 1 ? lastInfusionRef : null}>
            <Card>
              <div className="flex items-center justify-between px-4 py-3">
                <button
                  type="button"
                  onClick={() => updateInfusion(inf.uid, { open: !inf.open })}
                  className="flex-1 flex items-center justify-between text-[16px] font-semibold text-foreground"
                >
                  Пролив {idx + 1}
                  <CaretDownIcon
                    size={16}
                    className={`text-muted-foreground transition-transform ${inf.open ? 'rotate-180' : ''}`}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => removeInfusion(inf.uid)}
                  className="ml-3 text-destructive"
                >
                  <TrashIcon size={18} />
                </button>
              </div>
              {inf.open && (
                <div className="px-4 pb-4 flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Время пролива (с)">
                      <Input
                        inputMode="numeric"
                        value={inf.seconds}
                        onChange={(e) => updateInfusion(inf.uid, { seconds: e.target.value.replace(/\D/g, '') })}
                        placeholder="30"
                      />
                    </Field>
                    <Field label="Цвет настоя">
                      <Input
                        value={inf.liquor_color}
                        onChange={(e) => updateInfusion(inf.uid, { liquor_color: e.target.value })}
                        placeholder="Например: золотистый"
                      />
                    </Field>
                  </div>
                  <Section title="Дескрипторы вкуса">
                    <RichCheckboxGroup
                      options={TASTE_OPTIONS}
                      value={inf.taste}
                      onChange={(v) => updateInfusion(inf.uid, { taste: v })}
                    />
                  </Section>
                  <Section title="Особенные ноты пролива">
                    <Textarea
                      value={inf.special_notes}
                      onChange={(e) => updateInfusion(inf.uid, { special_notes: e.target.value })}
                      placeholder="Введите особенные ноты"
                      className="min-h-20"
                    />
                  </Section>
                  <Section title="Тело настоя">
                    <RichRadioGroup
                      options={BODY_OPTIONS}
                      value={inf.body}
                      onChange={(v) => updateInfusion(inf.uid, { body: v })}
                    />
                  </Section>
                  <Section title="Послевкусие">
                    <RichCheckboxGroup
                      options={AFTERTASTE_OPTIONS}
                      value={inf.aftertaste}
                      onChange={(v) => updateInfusion(inf.uid, { aftertaste: v })}
                    />
                  </Section>
                  <Section title="Заметка по проливу">
                    <Textarea
                      value={inf.note}
                      onChange={(e) => updateInfusion(inf.uid, { note: e.target.value })}
                      placeholder="Другое"
                      className="min-h-20"
                    />
                  </Section>
                </div>
              )}
            </Card>
            </div>
          ))}

          <button
            type="button"
            onClick={addInfusion}
            className="w-full flex items-center justify-center gap-2 h-10 rounded-full bg-surface-input border border-border-input shadow-xs text-[14px] font-medium text-foreground outline-none transition-colors focus-visible:border-accent-default focus-visible:ring-[3px] focus-visible:ring-ring-focus"
          >
            <PlusIcon size={16} />
            Добавить пролив
          </button>

          <Card>
            <Accordion className="w-full">
              <AccordionItem value="effects" className="border-b last:border-b-0">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  Ощущения
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <RichCheckboxGroup
                    options={EFFECTS_OPTIONS}
                    value={effects}
                    onChange={setEffects}
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>

          <Card>
            <Accordion className="w-full">
              <AccordionItem value="scenarios" className="border-b-0">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  Сценарии
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <RichCheckboxGroup
                    options={SCENARIOS_OPTIONS}
                    value={scenarios}
                    onChange={setScenarios}
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>

          <Card>
            <div className="px-4 py-3 flex flex-col gap-3">
              <p className="text-[14px] font-medium text-foreground text-center">Оценка</p>
              <RatingPicker value={rating} onChange={setRating} />
            </div>
          </Card>

          <Field label="Заметка по дегустации:">
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Другое"
              className="min-h-24"
            />
          </Field>

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
              : (mode === 'edit' ? 'Сохранить изменения' : 'Сохранить дегустацию')}
          </AppButton>
        </div>
      </div>
    </main>
    </>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[14px] font-medium text-foreground">{title}</p>
      {children}
    </div>
  );
}
