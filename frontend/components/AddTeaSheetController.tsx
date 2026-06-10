'use client';

import { Suspense } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import AddTeaSheet from '@/components/collection/AddTeaSheet';
import AddTeawareSheet from '@/components/collection/AddTeawareSheet';

function Inner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const add = searchParams.get('add');

  function close() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('add');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  function makeOnSaved(eventName: string, message: string) {
    return (_item: unknown) => {
      void _item;
      close();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(eventName));
      }
      if (pathname === '/collection') {
        toast.success(message);
      } else {
        toast.success(message, {
          action: { label: 'Открыть', onClick: () => router.push('/collection') },
        });
      }
    };
  }

  return (
    <>
      <AddTeaSheet
        open={add === 'tea'}
        onClose={close}
        onSaved={makeOnSaved('tea:added', 'Чай добавлен в коллекцию')}
      />
      <AddTeawareSheet
        open={add === 'teaware'}
        onClose={close}
        onSaved={makeOnSaved('teaware:added', 'Посуда добавлена в коллекцию')}
      />
    </>
  );
}

export default function AddTeaSheetController() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
