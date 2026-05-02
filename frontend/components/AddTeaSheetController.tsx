'use client';

import { Suspense } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import AddTeaSheet from '@/components/collection/AddTeaSheet';

function Inner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isOpen = searchParams.get('add') === 'tea';

  function close() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('add');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  function onSaved() {
    close();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tea:added'));
    }
    if (pathname === '/collection') {
      toast.success('Чай добавлен в коллекцию');
    } else {
      toast.success('Чай добавлен в коллекцию', {
        action: { label: 'Открыть', onClick: () => router.push('/collection') },
      });
    }
  }

  return <AddTeaSheet open={isOpen} onClose={close} onSaved={onSaved} />;
}

export default function AddTeaSheetController() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
