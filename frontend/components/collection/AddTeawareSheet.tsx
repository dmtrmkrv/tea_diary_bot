'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { XIcon, ImageSquareIcon } from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import RichRadioGroup from '@/components/form/RichRadioGroup';
import ToggleChips from '@/components/form/ToggleChips';
import { createTeaware, uploadTeawarePhoto, type Teaware } from '@/lib/apiClient';
import { compressImage } from '@/lib/imageCompression';
import ConfirmDiscardDialog from '@/components/ConfirmDiscardDialog';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

const TYPES = ['Гайвань', 'Хохин', 'Чайник', 'Типод', 'Колба', 'Кружка', 'Термос', 'Другое'];

const REGIONS = ['Исин', 'Цзяньшуй', 'Цзиндэчжэнь', 'Чаочжоу', 'Гуанси', 'Тайвань', 'Япония', 'Другое'];

const MATERIAL_GROUPS: { label: string; options: string[] }[] = [
  { label: 'Глины', options: ['Цзы Ни', 'Чжу Ни', 'Хун Ни', 'Дуань Ни', 'Лю Ни', 'Хэй Ни', 'Цзы Тао', 'Нисинтао'] },
  { label: 'Керамика и фарфор', options: ['Фарфор', 'Керамика'] },
  { label: 'Прочее', options: ['Стекло', 'Чугун', 'Серебро', 'Другое'] },
];

const SUITABLE_CATEGORIES = ['Белый', 'Жёлтый', 'Зелёный', 'Красный', 'Улун', 'Шу пуэр', 'Шен пуэр', 'Хэй ча'];

/** «Другое» + заполненный инпут → текст из инпута, иначе само значение селекта. */
function resolveOther(value: string | null, other: string): string | null {
  if (!value) return null;
  if (value === 'Другое' && other.trim()) return other.trim();
  return value;
}

export default function AddTeawareSheet({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (item: Teaware) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<string | null>(null);
  const [typeOther, setTypeOther] = useState('');
  const [region, setRegion] = useState('');
  const [regionOther, setRegionOther] = useState('');
  const [material, setMaterial] = useState('');
  const [materialOther, setMaterialOther] = useState('');
  const [volume, setVolume] = useState('');
  const [volumeError, setVolumeError] = useState(false);
  const [suitable, setSuitable] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isDirty = name.trim().length > 0 || type !== null || region !== ''
    || material !== '' || volume !== '' || suitable.length > 0
    || notes.trim() !== '' || photoFile !== null;
  const { confirmClose, discardDialogOpen, onConfirmDiscard, onCancelDiscard } = useUnsavedChanges(isDirty);

  useBodyScrollLock(open);

  function reset() {
    setName('');
    setType(null);
    setTypeOther('');
    setRegion('');
    setRegionOther('');
    setMaterial('');
    setMaterialOther('');
    setVolume('');
    setVolumeError(false);
    setSuitable([]);
    setNotes('');
    setPhotoFile(null);
    setPhotoPreview(null);
    setPhotoLoading(false);
    setSubmitting(false);
  }

  function handleClose() {
    confirmClose(() => { reset(); onClose(); });
  }

  function handleVolumeChange(v: string) {
    setVolume(v);
    setVolumeError(v !== '' && !/^\d+$/.test(v));
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
    if (!name.trim() || !type) return;
    if (volumeError) return;
    setSubmitting(true);
    try {
      const created = await createTeaware({
        name: name.trim(),
        type: resolveOther(type, typeOther),
        region: resolveOther(region || null, regionOther),
        material: resolveOther(material || null, materialOther),
        volume_ml: volume ? Number(volume) : null,
        suitable_csv: suitable.length > 0 ? suitable.join(', ') : null,
        notes: notes.trim() || null,
      });
      if (photoFile) {
        try {
          await uploadTeawarePhoto(created.id, photoFile);
        } catch {
          toast.error('Посуда добавлена, но фото не загрузилось');
        }
      }
      reset();
      onSaved(created);
    } catch {
      toast.error('Не удалось добавить посуду. Проверьте подключение и попробуйте ещё раз.');
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const canSave = name.trim().length > 0 && type !== null && !volumeError && !submitting;

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
      <div className="fixed left-1/2 -translate-x-1/2 bottom-0 w-full max-w-2xl z-[70] bg-card rounded-t-3xl flex flex-col max-h-[calc(100svh-100px)] overflow-hidden">
        <div className="flex justify-center pt-2 pb-1">
          <span className="w-9 h-1 rounded-full bg-border-strong" />
        </div>

        <div className="flex items-end justify-between px-4 pt-4 pb-3 shrink-0">
          <h2 className="text-[20px] font-semibold text-foreground">Новая посуда</h2>
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
          <div className="flex flex-col gap-2 pt-4">
            <Label htmlFor="tw-name" className="text-[14px] font-medium text-foreground">
              Название<span className="text-destructive">*</span>
            </Label>
            <Input
              id="tw-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Введите название посуды"
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-[14px] font-medium text-foreground">
              Тип посуды<span className="text-destructive">*</span>
            </p>
            <RichRadioGroup options={TYPES} value={type} onChange={setType} />
            {type === 'Другое' && (
              <Input
                value={typeOther}
                onChange={(e) => setTypeOther(e.target.value)}
                placeholder="Укажите тип посуды"
              />
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="tw-region" className="text-[14px] font-medium text-foreground">
              Регион
            </Label>
            <Select
              id="tw-region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            >
              <option value="">Выбрать</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </Select>
            {region === 'Другое' && (
              <Input
                value={regionOther}
                onChange={(e) => setRegionOther(e.target.value)}
                placeholder="Укажите регион"
              />
            )}
          </div>

          <div className="flex gap-2 items-start">
            <div className="flex flex-col gap-2 flex-1 min-w-0">
              <Label htmlFor="tw-material" className="text-[14px] font-medium text-foreground">
                Материал
              </Label>
              <Select
                id="tw-material"
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
              >
                <option value="">Выбрать</option>
                {MATERIAL_GROUPS.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.options.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-2 w-[114px] shrink-0">
              <Label htmlFor="tw-volume" className="text-[14px] font-medium text-foreground">
                Объем (мл)
              </Label>
              <Input
                id="tw-volume"
                inputMode="numeric"
                value={volume}
                onChange={(e) => handleVolumeChange(e.target.value)}
                placeholder="100"
                aria-invalid={volumeError}
              />
              {volumeError && (
                <p className="text-[12px] leading-[16px] text-destructive">только цифры</p>
              )}
            </div>
          </div>
          {material === 'Другое' && (
            <Input
              value={materialOther}
              onChange={(e) => setMaterialOther(e.target.value)}
              placeholder="Укажите материал"
            />
          )}

          <div className="flex flex-col gap-2">
            <p className="text-[14px] font-medium text-foreground">Подходит для чая:</p>
            <ToggleChips
              options={SUITABLE_CATEGORIES}
              value={suitable}
              onChange={setSuitable}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="tw-notes" className="text-[14px] font-medium text-foreground">
              Заметка
            </Label>
            <Textarea
              id="tw-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Заметка по посуде"
              className="min-h-20"
            />
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
            className="flex-1 h-10 rounded-full bg-primary text-[14px] font-medium text-primary-foreground disabled:opacity-50"
          >
            {submitting ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </>
  );
}
