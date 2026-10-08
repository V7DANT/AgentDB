import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/utils/cn';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Accessible modal dialog.
 *
 * Closes on Escape and on backdrop click, traps focus on the panel, and restores
 * focus to the previously active element on close.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Move focus into the dialog.
    window.setTimeout(() => panelRef.current?.focus(), 0);

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = original;
      previouslyFocused.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' } as const;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-base-950/75 p-4 pt-[8vh] backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'w-full animate-fade-in rounded-lg border border-base-700/80 bg-base-900 shadow-2xl outline-none',
          widths[size],
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-base-700/70 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-base-50">{title}</h2>
            {description ? (
              <p className="mt-1 text-xs leading-relaxed text-base-300">{description}</p>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close dialog"
            className="px-1.5"
          >
            <X className="h-4 w-4" />
          </Button>
        </header>

        {children ? <div className="px-4 py-4">{children}</div> : null}

        {footer ? (
          <footer className="flex items-center justify-end gap-2 border-t border-base-700/70 px-4 py-3">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger' | 'success';
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** Confirmation dialog with a consistent two-button footer. */
export function ConfirmDialog({
  open,
  title,
  description,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  pending = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button variant={tone} onClick={onConfirm} loading={pending}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
