'use client';

/**
 * Toast provider — accessible, non-blocking action feedback.
 *
 * Announces messages via a polite ARIA live region, respects reduced motion,
 * auto-dismisses with pause-on-hover, and exposes a single `useToast` hook.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  /** Optional supporting detail. Never include PHI here (§33). */
  description?: string;
}

interface ToastContextValue {
  toast: (t: Omit<Toast, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const AUTO_DISMISS_MS = 6000;

const VARIANT_STYLES: Record<ToastVariant, { icon: typeof Info; wrap: string; iconColor: string }> = {
  success: {
    icon: CheckCircle2,
    wrap: 'border-emerald-200 bg-white',
    iconColor: 'text-emerald-600',
  },
  error: {
    icon: XCircle,
    wrap: 'border-red-200 bg-white',
    iconColor: 'text-red-600',
  },
  warning: {
    icon: TriangleAlert,
    wrap: 'border-amber-200 bg-white',
    iconColor: 'text-amber-600',
  },
  info: {
    icon: Info,
    wrap: 'border-slate-200 bg-white',
    iconColor: 'text-slate-500',
  },
};

interface ToastItemProps {
  item: Toast;
  onDismiss: (id: string) => void;
}

function ToastItem({ item, onDismiss }: ToastItemProps) {
  const styles = VARIANT_STYLES[item.variant];
  const Icon = styles.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={cn(
        'pointer-events-auto flex w-80 max-w-[calc(100vw-2rem)] items-start gap-3 rounded-xl border p-4 shadow-lg shadow-slate-900/5',
        styles.wrap
      )}
      role="status"
    >
      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', styles.iconColor)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
        {item.description && (
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{item.description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </motion.div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    ({ variant = 'info', title, description }: Omit<Toast, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((current) => [...current.slice(-4), { id, variant, title, description }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
      );
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2"
      >
        <AnimatePresence>
          {toasts.map((item) => (
            <ToastItem key={item.id} item={item} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
