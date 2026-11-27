import { useCallback, useState } from 'react';
import ConfirmDialog, { type ConfirmOptions } from '../components/ConfirmDialog';

interface PendingConfirm extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
  returnFocusTo: HTMLElement | null;
}

export function useConfirm() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    const active = document.activeElement;
    setPending({ ...options, resolve, returnFocusTo: active instanceof HTMLElement ? active : null });
  }), []);

  const confirmDialog = pending && (
    <ConfirmDialog
      title={pending.title}
      message={pending.message}
      confirmLabel={pending.confirmLabel}
      tone={pending.tone}
      onResult={(confirmed) => {
        setPending(null);
        pending.resolve(confirmed);
        // Focus can only move back once the modal dialog has left the page.
        window.setTimeout(() => pending.returnFocusTo?.focus(), 0);
      }}
    />
  );

  return { confirm, confirmDialog };
}
