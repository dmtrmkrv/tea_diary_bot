'use client';

export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import QuickNoteForm from '@/components/QuickNoteForm';

export default function QuickNotePage() {
  return (
    <Suspense fallback={null}>
      <QuickNoteInner />
    </Suspense>
  );
}

// ?tea_item_id / ?teaware_id — предвыбор сорта/посуды (вход из шторок
// коллекции), по аналогии с /new.
function QuickNoteInner() {
  const searchParams = useSearchParams();
  const teaItemId = Number(searchParams.get('tea_item_id'));
  const teawareId = Number(searchParams.get('teaware_id'));

  return (
    <QuickNoteForm
      initialTeaItemId={Number.isNaN(teaItemId) ? null : teaItemId || null}
      initialTeawareId={Number.isNaN(teawareId) ? null : teawareId || null}
    />
  );
}
