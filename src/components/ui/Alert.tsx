import type { ReactNode } from 'react';
import { CircleCheck, Info, TriangleAlert, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

const VARIANTS: Record<AlertVariant, { icon: typeof Info; wrap: string; iconColor: string }> = {
  info: { icon: Info, wrap: 'bg-info-subtle text-info ring-info/20', iconColor: 'text-info' },
  success: {
    icon: CircleCheck,
    wrap: 'bg-success-subtle text-success ring-success/20',
    iconColor: 'text-success',
  },
  warning: {
    icon: TriangleAlert,
    wrap: 'bg-warning-subtle text-warning ring-warning/20',
    iconColor: 'text-warning',
  },
  danger: { icon: XCircle, wrap: 'bg-danger-subtle text-danger ring-danger/20', iconColor: 'text-danger' },
};

export interface AlertProps {
  variant?: AlertVariant;
  /** Short headline, e.g. "Verification queue overdue". */
  title: string;
  /** Supporting detail. Never include PHI (§33). */
  description?: string;
  /** Optional action (usually a Link or Button) rendered inline. */
  action?: ReactNode;
  className?: string;
}

/**
 * Persistent operational alert (§45) — for issues that must remain visible
 * until resolved. Transient notices use ToastProvider instead (§44).
 */
export function Alert({ variant = 'info', title, description, action, className }: AlertProps) {
  const styles = VARIANTS[variant];
  const Icon = styles.icon;

  return (
    <div
      role={variant === 'danger' ? 'alert' : 'status'}
      className={cn('flex items-start gap-3 rounded-lg p-4 ring-1 ring-inset', styles.wrap, className)}
    >
      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', styles.iconColor)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        {description && <p className="mt-0.5 text-sm opacity-90">{description}</p>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}
