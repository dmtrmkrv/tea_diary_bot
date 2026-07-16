'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { DotsThreeOutlineIcon } from '@phosphor-icons/react';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import { deleteTasting } from '@/lib/apiClient';

// tastingId — глобальный id для API-вызовов; seqNo — персональный номер для URL.
export default function TastingActions({ tastingId, seqNo }: { tastingId: number; seqNo: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function handleDelete() {
    setConfirmDelete(false);
    setDeleting(true);
    try {
      await deleteTasting(tastingId);
      toast.success('Дегустация удалена');
      router.push('/');
      router.refresh();
    } catch {
      toast.error('Не удалось удалить дегустацию. Попробуйте ещё раз.');
      setDeleting(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="bg-button-icon-bg border border-button-icon-border flex items-center justify-center h-9 w-9 rounded-full text-foreground"
        aria-label="Действия"
      >
        <DotsThreeOutlineIcon size={16} weight="fill" />
      </button>
      {open && (
        <div className="absolute right-0 top-10 bg-popover rounded-lg shadow-lg z-50 overflow-hidden min-w-[160px]">
          <button
            className="w-full text-left px-4 py-3 text-[14px] text-foreground hover:bg-surface-sunken transition-colors border-b border-border-default"
            onClick={() => { setOpen(false); router.push(`/tastings/${seqNo}/edit`); }}
          >
            Редактировать
          </button>
          <button
            className="w-full text-left px-4 py-3 text-[14px] text-destructive hover:bg-surface-sunken transition-colors disabled:opacity-50"
            disabled={deleting}
            onClick={() => { setOpen(false); setConfirmDelete(true); }}
          >
            {deleting ? 'Удаление…' : 'Удалить'}
          </button>
        </div>
      )}

      <ConfirmDeleteDialog
        open={confirmDelete}
        title="Удалить дегустацию?"
        description="Действие нельзя отменить. Если при создании списывался остаток сорта — он вернётся в коллекцию."
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
