import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from '@/utils/cn';

type ToastTone = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastContextValue {
  push: (toast: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONES: Record<ToastTone, { icon: typeof Info; className: string }> = {
  success: { icon: CheckCircle2, className: 'border-status-ok/30 text-status-ok' },
  error: { icon: XCircle, className: 'border-status-danger/30 text-status-danger' },
  warning: { icon: AlertTriangle, className: 'border-status-warn/30 text-status-warn' },
  info: { icon: Info, className: 'border-status-info/30 text-status-info' },
};

/** Minimal toast system — no external dependency. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((current) => [...current.slice(-3), { ...toast, id }]);
      window.setTimeout(() => dismiss(id), 6000);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((toast) => {
          const { icon: Icon, className } = TONES[toast.tone];
          return (
            <div
              key={toast.id}
              role="status"
              className={cn(
                'pointer-events-auto flex animate-fade-in items-start gap-2.5 rounded-md border bg-base-900/98 px-3 py-2.5 shadow-2xl backdrop-blur',
                className,
              )}
            >
              <Icon className="mt-px h-4 w-4 shrink-0" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-base-50">{toast.title}</p>
                {toast.description ? (
                  <p className="mt-0.5 text-2xs leading-relaxed text-base-300">
                    {toast.description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="rounded p-0.5 text-base-400 hover:bg-base-800 hover:text-base-100"
                aria-label="Dismiss notification"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (context === null) {
    throw new Error('useToast must be used inside <ToastProvider>.');
  }
  return context;
}
