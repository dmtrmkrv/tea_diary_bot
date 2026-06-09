'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { XIcon, ImageSquareIcon } from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import RichRadioGroup from '@/components/form/RichRadioGroup';
import { createTeaItem, uploadTeaItemPhoto, type TeaItem } from '@/lib/apiClient';
import ConfirmDiscardDialog from '@/components/ConfirmDiscardDialog';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

const CATEGORIES = [
  'Белый',
  'Жёлтый',
  'Зелёный',
  'Красный',
  'Улун',
  'Шу пуэр',
  'Шен пуэр',
  'Хэй ча',
  'Другое',
];

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
  const [yearError, setYearError] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isDirty = name.trim().length > 0 || category !== null || year !== '' || region !== '' || photoFile !== null;
  const { confirmClose, discardDialogOpen, onConfirmDiscard, onCancelDiscard } = useUnsavedChanges(isDirty);

  function reset() {
    setName('');
    setCategory(null);
    setYear('');
    setRegion('');
    setYearError(false);
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

  function handlePhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhotoLoading(true);
    setPhotoFile(f);
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(reader.result as string);
      setPhotoLoading(false);
    };
    reader.readAsDataURL(f);
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
    setSubmitting(true);
    try {
      const created = await createTeaItem({
        name: name.trim(),
        category: category || null,
        year: year ? Number(year) : null,
        region: region.trim() || null,
      });
      if (photoFile) {
        await uploadTeaItemPhoto(created.id, photoFile);
      }
      reset();
      onSaved(created);
    } catch {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const canSave = name.trim().length > 0 && !yearError && !submitting;

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
      <div className="fixed left-0 right-0 bottom-0 z-[70] bg-card rounded-t-3xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="flex justify-center pt-2 pb-1">
          <span className="w-9 h-1 rounded-full bg-border-strong" />
        </div>

        <div className="flex items-end justify-between px-4 pt-4 pb-4 shrink-0">
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

        <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
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

          <div className="flex flex-col gap-1.5">
            <p className="text-[14px] font-medium text-foreground">Категория</p>
            <RichRadioGroup
              options={CATEGORIES}
              value={category}
              onChange={setCategory}
              cols={3}
            />
          </div>

          <div className="flex gap-2 items-start">
            <div className="flex flex-col gap-1.5 w-[114px] shrink-0">
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
            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              <Label htmlFor="tea-region" className="text-[14px] font-medium text-foreground">
                Регион
              </Label>
              <Input
                id="tea-region"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="Например: Юньнань, Китай"
              />
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
            className="flex-1 h-10 rounded-full bg-surface-sunken text-[14px] font-medium text-foreground"
          >
            Отменить
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="flex-[2] h-10 rounded-full bg-primary text-[14px] font-medium text-primary-foreground disabled:opacity-50"
          >
            {submitting ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </>
  );
}
