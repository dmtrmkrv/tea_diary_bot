'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { XIcon, ImageSquareIcon } from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import RichRadioGroup from '@/components/form/RichRadioGroup';
import { createTeaItem, uploadTeaItemPhoto, type TeaItem } from '@/lib/apiClient';
import { compressImage } from '@/lib/imageCompression';
import { Spinner } from '@/components/ui/spinner';
import ConfirmDiscardDialog from '@/components/ConfirmDiscardDialog';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

// В UI пуэры сокращены до «Шу»/«Шен» (3 колонки без переносов),
// в БД сохраняются канонические формы — см. CATEGORY_CANONICAL.
const CATEGORIES = [
  'Белый',
  'Жёлтый',
  'Зелёный',
  'Красный',
  'Улун',
  'Шу',
  'Шен',
  'Хэй ча',
  'Другое',
];

const CATEGORY_CANONICAL: Record<string, string> = {
  'Шу': 'Шу пуэр',
  'Шен': 'Шен пуэр',
};

export default function AddTeaSheet({
  open,
  onClose,
  onSaved,
  initialName,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (item: TeaItem) => void;
  initialName?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initialName ?? '');
  const [lastInitial, setLastInitial] = useState(initialName);
  if (initialName !== lastInitial) {
    setLastInitial(initialName);
    setName(initialName ?? '');
  }
  const [category, setCategory] = useState<string | null>(null);
  const [year, setYear] = useState('');
  const [region, setRegion] = useState('');
  const [amount, setAmount] = useState('');
  const [yearError, setYearError] = useState(false);
  const [amountError, setAmountError] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isDirty = name.trim().length > 0 || category !== null || year !== '' || region !== '' || amount !== '' || photoFile !== null;
  const { confirmClose, discardDialogOpen, onConfirmDiscard, onCancelDiscard } = useUnsavedChanges(isDirty);

  function reset() {
    setName('');
    setCategory(null);
    setYear('');
    setRegion('');
    setAmount('');
    setYearError(false);
    setAmountError(false);
    setPhotoFile(null);
    setPhotoPreview(null);
    setPhotoLoading(false);
    setSubmitting(false);
  }

  function handleClose() {
    confirmClose(() => { reset(); onClose(); });
  }

  function handleYearChange(v: string) {
    setYear(v);
    if (v === '') {
      setYearError(false);
      return;
    }
    setYearError(!/^\d+$/.test(v));
  }

  function handleAmountChange(v: string) {
    setAmount(v);
    setAmountError(v !== '' && !/^\d+$/.test(v));
  }

  async function handlePhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhotoLoading(true);
    const compressed = await compressImage(f);
    setPhotoFile(compressed);
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(reader.result as string);
      setPhotoLoading(false);
    };
    reader.readAsDataURL(compressed);
  }

  function removePhoto() {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSave() {
    if (!name.trim()) return;
    if (year && !/^\d+$/.test(year)) {
      setYearError(true);
      return;
    }
    if (amountError) return;
    setSubmitting(true);
    try {
      const created = await createTeaItem({
        name: name.trim(),
        category: category ? (CATEGORY_CANONICAL[category] ?? category) : null,
        year: year ? Number(year) : null,
        region: region.trim() || null,
        amount_g: amount ? Number(amount) : null,
      });
      if (photoFile) {
        try {
          await uploadTeaItemPhoto(created.id, photoFile);
        } catch (e) {
          // Чай уже создан, фото не приложилось — не блокируем onSaved,
          // но сообщаем юзеру (с причиной, если бэк её прислал).
          const err = e as { code?: string; message?: string };
          toast.error(err.code ? `Чай добавлен, но фото не загрузилось: ${err.message}` : 'Чай добавлен, но фото не загрузилось');
        }
      }
      reset();
      onSaved(created);
    } catch (e) {
      const err = e as { status?: number };
      toast.error(
        err.status === 422
          ? 'Проверьте введённые значения и попробуйте ещё раз.'
          : 'Не удалось добавить чай. Проверьте подключение и попробуйте ещё раз.'
      );
      setSubmitting(false);
    }
  }

  useBodyScrollLock(open);

  if (!open) return null;

  const canSave = name.trim().length > 0 && !yearError && !amountError && !submitting;

  return (
    <>
      <ConfirmDiscardDialog
        open={discardDialogOpen}
        onConfirm={onConfirmDiscard}
        onCancel={onCancelDiscard}
      />
      <div
        className="fixed inset-0 z-[60] bg-overlay-scrim backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="fixed left-1/2 -translate-x-1/2 bottom-0 w-full max-w-2xl z-[70] bg-card rounded-t-3xl flex flex-col max-h-[calc(100svh-48px)] overflow-hidden">
        <div className="flex justify-center pt-2 pb-1">
          <span className="w-9 h-1 rounded-full bg-border-strong" />
        </div>

        <div className="flex items-end justify-between px-4 pt-4 pb-3 shrink-0">
          <h2 className="text-[20px] font-semibold text-foreground">Новый чай</h2>
          <button
            type="button"
            onClick={handleClose}
            className="w-6 h-6 rounded-full bg-overlay-dialog flex items-center justify-center shrink-0"
          >
            <XIcon size={11} className="text-text-light" weight="bold" />
          </button>
        </div>

        <div className="h-px bg-border-default shrink-0" />

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4 flex flex-col gap-[18px]">
          <div className="flex flex-col gap-2">
            <Label htmlFor="tea-name" className="text-[14px] font-medium text-foreground">
              Название<span className="text-destructive">*</span>
            </Label>
            <Input
              id="tea-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Шен Пуэр Лао Мань"
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-[14px] font-medium text-foreground">Категория</p>
            <RichRadioGroup
              options={CATEGORIES}
              value={category}
              onChange={setCategory}
              cols={3}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="tea-region" className="text-[14px] font-medium text-foreground">
              Регион
            </Label>
            <Input
              id="tea-region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="Например: Юньнань"
            />
          </div>

          <div className="flex gap-2 items-start">
            <div className="flex flex-col gap-2 w-[114px] shrink-0">
              <Label htmlFor="tea-year" className="text-[14px] font-medium text-foreground">
                Год сбора
              </Label>
              <Input
                id="tea-year"
                inputMode="numeric"
                value={year}
                onChange={(e) => handleYearChange(e.target.value)}
                placeholder="2025"
                aria-invalid={yearError}
              />
              {yearError && (
                <p className="text-[12px] leading-[16px] text-destructive">только цифры</p>
              )}
            </div>
            <div className="flex flex-col gap-2 flex-1 min-w-0">
              <Label htmlFor="tea-amount" className="text-[14px] font-medium text-foreground">
                Количество в наличии (гр)
              </Label>
              <Input
                id="tea-amount"
                inputMode="numeric"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="100"
                aria-invalid={amountError}
              />
              {amountError && (
                <p className="text-[12px] leading-[16px] text-destructive">только цифры</p>
              )}
            </div>
          </div>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoPick}
            />
            {photoLoading ? (
              <div className="w-[76px] h-[76px] rounded-xl bg-placeholder-tea-bg flex items-center justify-center">
                <span className="w-5 h-5 rounded-full border-2 border-border-strong border-t-text-secondary animate-spin" />
              </div>
            ) : photoPreview ? (
              <div className="relative w-[76px] h-[76px] rounded-xl overflow-hidden">
                <Image src={photoPreview} alt="" fill className="object-cover" />
                <button
                  type="button"
                  onClick={removePhoto}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-overlay-dialog flex items-center justify-center"
                >
                  <XIcon size={12} className="text-text-light" weight="bold" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-10 rounded-full border border-border-input bg-surface-input flex items-center justify-center gap-2 text-[14px] font-medium text-foreground shadow-xs outline-none transition-colors focus-visible:border-accent-default focus-visible:ring-[3px] focus-visible:ring-ring-focus"
              >
                <ImageSquareIcon size={16} />
                Добавить фото
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-2 p-4 border-t border-border-default bg-card">
          <button
            type="button"
            onClick={handleClose}
            className="w-[120px] shrink-0 h-10 rounded-full bg-surface-sunken text-[14px] font-medium text-muted-foreground"
          >
            Отменить
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1 h-10 rounded-full bg-primary text-[14px] font-medium text-primary-foreground disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (<><Spinner className="size-4" />Сохранение…</>) : 'Сохранить чай'}
          </button>
        </div>
      </div>
    </>
  );
}
