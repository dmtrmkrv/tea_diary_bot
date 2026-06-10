'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
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
  type RichCheckboxState,
} from '@/components/form/RichCheckboxGroup';
import RichRadioGroup from '@/components/form/RichRadioGroup';
import RatingPicker from '@/components/form/RatingPicker';
import TeaCombobox from '@/components/form/TeaCombobox';
import TeawareCombobox from '@/components/form/TeawareCombobox';
import {
  createTasting,
  uploadTastingPhotos,
  getTeaCollection,
  getTeawareCollection,
  type TeaItem,
  type Teaware,
} from '@/lib/apiClient';
import ConfirmDiscardDialog from '@/components/ConfirmDiscardDialog';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { compressImage } from '@/lib/imageCompression';

const AROMA_OPTIONS = [
  'Хлебный', 'Кондитерский', 'Ореховый', 'Сухофрукты',
  'Цветочный', 'Ягодный', 'Фруктовый', 'Травянистый',
  'Овощной', 'Пряный', 'Древесный', 'Землистый',
  'Дымный', 'Минеральный',
];

const TASTE_OPTIONS = AROMA_OPTIONS;

const AFTERTASTE_OPTIONS = [
  'Сладкое', 'Кислое', 'Горькое', 'Пряное',
  'Кондитерское', 'Ореховое', 'Цветочное', 'Фруктовое',
  'Овощное', 'Травянистое', 'Древесное', 'Землистое',
  'Дымное', 'Минеральное',
];

const BODY_OPTIONS = ['Тонкое', 'Лёгкое', 'Среднее', 'Плотное', 'Маслянистое'];

const EFFECTS_OPTIONS = [
  'Тепло', 'Охлаждение', 'Расслабление', 'Фокус',
  'Бодрость', 'Тонус', 'Спокойствие', 'Сонливость',
];

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

export default function NewTastingPage() {
  return (
    <Suspense fallback={null}>
      <NewTastingInner />
    </Suspense>
  );
}

function NewTastingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTeaItemId = searchParams.get('tea_item_id');
  const initialTeawareId = searchParams.get('teaware_id');

  const [name, setName] = useState('');
  const [teaItem, setTeaItem] = useState<TeaItem | null>(null);
  const [teaware, setTeaware] = useState<Teaware | null>(null);
  const [grams, setGrams] = useState('');
  const [tempC, setTempC] = useState('');

  const [aromaDry, setAromaDry] = useState<RichCheckboxState>({ ...emptyRichCheckboxState });
  const [aromaWarmed, setAromaWarmed] = useState<RichCheckboxState>({ ...emptyRichCheckboxState });

  const [infusions, setInfusions] = useState<Infusion[]>([]);
  const nextInfusionUid = useRef(1);

  const [effects, setEffects] = useState<RichCheckboxState>({ ...emptyRichCheckboxState });
  const [scenarios, setScenarios] = useState<RichCheckboxState>({ ...emptyRichCheckboxState });

  const [rating, setRating] = useState(0);
  const [summary, setSummary] = useState('');

  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [photoCompressing, setPhotoCompressing] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const isDirty = name.trim().length > 0 || teaItem !== null || teaware !== null
    || grams !== '' || tempC !== '' || infusions.length > 0
    || rating > 0 || summary.trim() !== '' || photos.length > 0;
  const { confirmClose, discardDialogOpen, onConfirmDiscard, onCancelDiscard } = useUnsavedChanges(isDirty);

  const lastInfusionRef = useRef<HTMLDivElement | null>(null);
  const prevInfusionCount = useRef(0);

  useEffect(() => {
    if (infusions.length > prevInfusionCount.current) {
      lastInfusionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    prevInfusionCount.current = infusions.length;
  }, [infusions.length]);

  useEffect(() => {
    if (!initialTeaItemId) return;
    const id = Number(initialTeaItemId);
    if (Number.isNaN(id)) return;
    let cancelled = false;
    getTeaCollection(100, 0)
      .then((res) => {
        if (cancelled) return;
        const found = res.items.find((i) => i.id === id);
        if (found) setTeaItem(found);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [initialTeaItemId]);

  useEffect(() => {
    if (!initialTeawareId) return;
    const id = Number(initialTeawareId);
    if (Number.isNaN(id)) return;
    let cancelled = false;
    getTeawareCollection(100, 0)
      .then((res) => {
        if (cancelled) return;
        const found = res.items.find((i) => i.id === id);
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
    const room = 3 - photos.length;
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

  async function handleSave() {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
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
        entry_mode: 'web',
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

      const created = await createTasting(payload);
      if (photos.length > 0) {
        try {
          await uploadTastingPhotos(created.id, photos);
        } catch {
          // Дегустация уже создана, продолжаем редирект,
          // но предупреждаем юзера что фото не приложились
          toast.error('Дегустация сохранена, но фото не загрузились');
        }
      }
      router.push(`/tastings/${created.id}`);
    } catch {
      toast.error('Не удалось сохранить дегустацию. Проверьте подключение и попробуйте ещё раз.');
      setSubmitting(false);
    }
  }

  const canSave = name.trim().length > 0 && !submitting;

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
            onClick={() => confirmClose(() => router.push('/'))}
            className="w-9 h-9 rounded-full bg-button-icon-bg border border-button-icon-border flex items-center justify-center"
          >
            <ArrowLeftIcon size={16} className="text-foreground" />
          </button>
          <h1 className="text-[20px] font-semibold text-foreground">Новая дегустация</h1>
        </div>

        <div className="flex flex-col gap-4">
          <Field label="Название дегустации" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Дянь хун в гайвани"
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
              disabled={photos.length >= 3 || photoCompressing}
              className="w-full h-10 rounded-full bg-surface-input border border-border-input shadow-xs flex items-center justify-center gap-2 text-[14px] font-medium text-foreground outline-none transition-colors focus-visible:border-accent-default focus-visible:ring-[3px] focus-visible:ring-ring-focus disabled:opacity-50"
            >
              <ImageSquareIcon size={16} />
              {photoCompressing ? 'Обработка фото…' : 'Добавить фото (до 3 фото)'}
            </button>
            {photoPreviews.length > 0 && (
              <div className="flex gap-2 mt-2">
                {photoPreviews.map((src, idx) => (
                  <div key={idx} className="relative w-[76px] h-[76px] rounded-xl overflow-hidden">
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

      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border-default py-3 z-40">
        <div className="max-w-2xl mx-auto px-4 flex gap-2">
          <button
            type="button"
            onClick={() => confirmClose(() => router.push('/'))}
            className="flex-1 h-10 rounded-full bg-surface-sunken text-[14px] font-medium text-foreground"
          >
            Отменить
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="flex-[2] h-10 rounded-full bg-primary text-primary-foreground text-[14px] font-medium disabled:opacity-50"
          >
            {submitting ? 'Сохранение…' : 'Сохранить'}
          </button>
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
