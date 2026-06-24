'use client';

export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import TastingForm from '@/components/TastingForm';

export default function NewTastingPage() {
  return (
    <Suspense fallback={null}>
      <NewTastingInner />
    </Suspense>
  );
}

function NewTastingInner() {
  const searchParams = useSearchParams();
  const teaItemId = Number(searchParams.get('tea_item_id'));
  const teawareId = Number(searchParams.get('teaware_id'));

  return (
    <TastingForm
      mode="create"
      initialTeaItemId={Number.isNaN(teaItemId) ? null : teaItemId || null}
      initialTeawareId={Number.isNaN(teawareId) ? null : teawareId || null}
    />
  );
}
