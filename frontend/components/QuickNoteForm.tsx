'use client';

import { useRef, useState } from 'react';
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
  type RichCheckboxState,
} from '@/components/form/RichCheckboxGroup';
import RatingPicker from '@/components/form/RatingPicker';
import TeaCombobox from '@/components/form/TeaCombobox';
import TeawareCombobox from '@/components/form/TeawareCombobox';
import {
  createTasting,
  uploadTastingPhotos,
  type TeaItem,
  type Teaware,
} from '@/lib/apiClient';
import ConfirmDiscardDialog from '@/components/ConfirmDiscardDialog';
import { AROMA_OPTIONS, EFFECTS_OPTIONS } from '@/lib/constants';
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
  if (state.other.trim()) parts.push(state.other.trim());
  return parts.join(', ');
}

export default function QuickNoteForm() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [teaItem, setTeaItem] = useState<TeaItem | null>(null);
  const [teaware, setTeaware] = useState<Teaware | null>(null);
  const [grams, setGrams] = useState('');
  const [tempC, setTempC] = useState('');

  const [aroma, setAroma] = useState<RichCheckboxState>(emptyRichCheckboxState);
  const [taste, setTaste] = useState<RichCheckboxState>(emptyRichCheckboxState);
  const [effects, setEffects] = useState<RichCheckboxState>(emptyRichCheckboxState);

  const [rating, setRating] = useState(0);
  const [summary, setSummary] = useState('');

  // Эксклюзивное раскрытие «Аромат»/«Вкус»: открыт максимум один
  // (решение из макетов: в фокусе всегда одна секция).
  const [openTags, setOpenTags] = useState<string[]>(['aroma']);
  // Опциональный блок посуды — независимый, по умолчанию свёрнут.
  const [openGear, setOpenGear] = useState<string[]>([]);

  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [photoCompressing, setPhotoCompressing] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);

  const isDirty =
    name.trim().length > 0 || teaItem !== null || teaware !== null
    || grams !== '' || tempC !== ''
    || aroma.selected.length > 0 || aroma.other.trim() !== ''
    || taste.selected.length > 0 || taste.other.trim() !== ''
    || effects.selected.length > 0 || effects.other.trim() !== ''
    || rating > 0 || summary.trim() !== '' || photos.length > 0;
  const { confirmClose, discardDialogOpen, onConfirmDiscard, onCancelDiscard } = useUnsavedChanges(isDirty);

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
    if (!canSave) return;
    setSubmitting(true);
    try {
      const created = await createTasting({
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
        entry_mode: 'quick',
        infusions: [],
      });
      if (photos.length > 0) {
        try {
          await uploadTastingPhotos(created.id, photos);
        } catch (e) {
          const err = e as { code?: string; message?: string };
          toast.error(err.code ? `Заметка сохранена, но фото не загрузилось: ${err.message}` : 'Заметка сохранена, но фото не загрузились');
        }
      }
      router.push(`/tastings/${created.id}`);
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

  const canSave = name.trim().length > 0 && teaItem !== null && !submitting;

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
            onClick={() => confirmClose(() => router.push('/'))}
            className="w-9 h-9 rounded-full bg-button-icon-bg border border-button-icon-border flex items-center justify-center"
          >
            <ArrowLeftIcon size={16} className="text-foreground" />
          </button>
          <h1 className="text-[20px] font-semibold text-foreground">Быстрая заметка</h1>
        </div>

        <div className="flex flex-col gap-4">
          <Field label="Название" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Дянь хун в гайвани"
            />
          </Field>

          <Field label="Выберите чай" required>
            <TeaCombobox value={teaItem} onChange={setTeaItem} />
          </Field>

          <Card>
            <Accordion className="w-full" multiple={false} value={openGear} onValueChange={setOpenGear}>
              <AccordionItem value="gear" className="border-b-0">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <SectionTitle
                    title="Посуда • Вес • Температура"
                    preview={!openGear.includes('gear') ? gearPreview : ''}
                  />
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
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
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>

          <Card>
            <Accordion className="w-full" multiple={false} value={openTags} onValueChange={setOpenTags}>
              <AccordionItem value="aroma" className="border-b last:border-b-0">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <SectionTitle
                    title="Аромат"
                    preview={!openTags.includes('aroma') ? tagsPreview(aroma) : ''}
                  />
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <RichCheckboxGroup
                    options={AROMA_OPTIONS}
                    value={aroma}
                    onChange={setAroma}
                  />
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="taste" className="border-b-0">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <SectionTitle
                    title="Вкус"
                    preview={!openTags.includes('taste') ? tagsPreview(taste) : ''}
                  />
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <RichCheckboxGroup
                    options={AROMA_OPTIONS}
                    value={taste}
                    onChange={setTaste}
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>

          <Card>
            <div className="px-4 py-3 flex flex-col gap-3">
              <p className="text-[14px] font-medium text-foreground">Ощущения</p>
              <RichCheckboxGroup
                options={EFFECTS_OPTIONS}
                value={effects}
                onChange={setEffects}
              />
            </div>
          </Card>

          <Card>
            <div className="px-4 py-3 flex flex-col gap-3">
              <p className="text-[14px] font-medium text-foreground text-center">Оценка</p>
              <RatingPicker value={rating} onChange={setRating} />
            </div>
          </Card>

          <Field label="Заметка:">
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Пара слов о впечатлении"
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
              <div className="flex gap-2 mt-2 flex-wrap">
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

      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border-default z-40">
        <div className="max-w-2xl mx-auto p-4 flex gap-2">
          <AppButton
            type="button"
            variant="secondary"
            onClick={() => confirmClose(() => router.push('/'))}
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
            {submitting ? (<><Spinner className="size-4" />Сохранение…</>) : 'Сохранить'}
          </AppButton>
        </div>
      </div>
    </main>
    </>
  );
}

// Заголовок секции-аккордеона с превью выбранного в свёрнутом состоянии.
function SectionTitle({ title, preview }: { title: string; preview: string }) {
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[16px] font-semibold text-foreground">{title}</span>
      {preview && (
        <span className="truncate text-[12px] font-normal text-text-secondary">{preview}</span>
      )}
    </span>
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
