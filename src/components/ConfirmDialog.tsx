import { useEffect, useId, useRef, type ReactNode } from 'react';

export interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  tone = 'danger',
  onResult,
}: ConfirmOptions & { onResult: (confirmed: boolean) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="app-dialog app-dialog--confirm"
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={messageId}
      onCancel={(event) => {
        event.preventDefault();
        onResult(false);
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onResult(false);
      }}
    >
      <div className="app-dialog-body">
        <h2 id={titleId} className="app-dialog-title">{title}</h2>
        <div id={messageId} className="app-dialog-message">{message}</div>
        <div className="app-dialog-actions">
          <button type="button" className="btn btn--secondary" autoFocus onClick={() => onResult(false)}>
            Hủy
          </button>
          <button
            type="button"
            className={`btn ${tone === 'danger' ? 'btn--danger' : 'btn--primary'}`}
            onClick={() => onResult(true)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
