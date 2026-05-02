'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { XIcon, ImageSquareIcon } from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createTeaItem, uploadTeaItemPhoto } from '@/lib/apiClient';

const CATEGORIES: { name: string; border: string; text: string }[] = [
  { name: 'Белый',     border: 'border-[#fef3c7]', text: 'text-[#1c1917]' },
  { name: 'Желтый',    border: 'border-[#fde68a]', text: 'text-[#1c1917]' },
  { name: 'Зелёный',   border: 'border-[#bbf7d0]', text: 'text-[#1c1917]' },
  { name: 'Красный',   border: 'border-[#c2410c]', text: 'text-[#c2410c]' },
  { name: 'Улун',      border: 'border-[#0e7490]', text: 'text-[#0e7490]' },
  { name: 'Шу пуэр',   border: 'border-[#713f12]', text: 'text-[#713f12]' },
  { name: 'Шен пуэр',  border: 'border-[#fb923c]', text: 'text-[#c2410c]' },
  { name: 'Хэй ча',    border: 'border-[#44403c]', text: 'text-[#44403c]' },
  { name: 'Другое',    border: 'border-[#d6d3d1]', text: 'text-[#57534e]' },
];

export default function AddTeaSheet({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [year, setYear] = useState('');
  const [region, setRegion] = useState('');
  const [yearError, setYearError] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
    reset();
    onClose();
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
      onSaved();
    } catch {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const canSave = name.trim().length > 0 && !yearError && !submitting;

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="fixed left-0 right-0 bottom-0 z-[70] bg-white rounded-t-3xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="flex justify-center pt-2 pb-1">
          <span className="w-9 h-1 rounded-full bg-[#d6d3d1]" />
        </div>

        <div className="flex items-center justify-between px-4 pt-2 pb-3">
          <h2 className="text-[18px] font-semibold text-[#1c1917]">Новый чай</h2>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-[#1c1917] flex items-center justify-center"
          >
            <XIcon size={16} className="text-white" weight="bold" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tea-name" className="text-[14px] font-medium text-[#1c1917]">
              Название<span className="text-[#dc2626]">*</span>
            </Label>
            <Input
              id="tea-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Шен Пуэр Лао Мань"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="text-[14px] font-medium text-[#1c1917]">Категория</p>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((c) => {
                const active = category === c.name;
                return (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => setCategory(active ? null : c.name)}
                    className={`flex items-center justify-between gap-1 h-9 px-3 rounded-full border-2 ${c.border} ${c.text} text-[14px] font-medium transition-colors`}
                  >
                    <span className="truncate">{c.name}</span>
                    <span
                      className={`w-3 h-3 rounded-full border ${c.border} flex items-center justify-center shrink-0`}
                    >
                      {active && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tea-year" className="text-[14px] font-medium text-[#1c1917]">
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
                <p className="text-[12px] leading-[16px] text-[#dc2626]">только цифры</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tea-region" className="text-[14px] font-medium text-[#1c1917]">
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
              <div className="w-[76px] h-[76px] rounded-xl bg-[#f5f5f4] flex items-center justify-center">
                <span className="w-5 h-5 rounded-full border-2 border-[#d6d3d1] border-t-[#57534e] animate-spin" />
              </div>
            ) : photoPreview ? (
              <div className="relative w-[76px] h-[76px] rounded-xl overflow-hidden">
                <Image src={photoPreview} alt="" fill className="object-cover" />
                <button
                  type="button"
                  onClick={removePhoto}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#1c1917] flex items-center justify-center"
                >
                  <XIcon size={12} className="text-white" weight="bold" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-10 rounded-full border border-[#e5e5e5] bg-white flex items-center justify-center gap-2 text-[14px] font-medium text-[#1c1917]"
              >
                <ImageSquareIcon size={16} />
                Добавить фото
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-2 p-4 border-t border-[#e7e5e4] bg-white">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 h-10 rounded-full bg-[#f5f5f4] text-[14px] font-medium text-[#1c1917]"
          >
            Отменить
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="flex-[2] h-10 rounded-full bg-[#b45309] text-[14px] font-medium text-white disabled:opacity-50"
          >
            {submitting ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </>
  );
}
