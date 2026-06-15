'use client';

import { useRef, useState } from 'react';

export function useUnsavedChanges(isDirty: boolean) {
  const [showDialog, setShowDialog] = useState(false);
  const pendingCallback = useRef<(() => void) | null>(null);

  function confirmClose(onConfirm: () => void) {
    if (!isDirty) {
      onConfirm();
      return;
    }
    pendingCallback.current = onConfirm;
    setShowDialog(true);
  }

  function handleConfirmDiscard() {
    setShowDialog(false);
    pendingCallback.current?.();
    pendingCallback.current = null;
  }

  function handleCancelDiscard() {
    setShowDialog(false);
    pendingCallback.current = null;
  }

  return {
    confirmClose,
    discardDialogOpen: showDialog,
    onConfirmDiscard: handleConfirmDiscard,
    onCancelDiscard: handleCancelDiscard,
  };
}
