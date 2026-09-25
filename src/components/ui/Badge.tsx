import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { STATUS_TONE_CLASSES, type StatusTone } from '@/constants/status';

type BadgeVariant = StatusTone;

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

/** Static badge for non-status labels (counts, IDs, categories). */
export function Badge({ variant = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
        STATUS_TONE_CLASSES[variant],
        className
      )}
      {...props}
    />
  );
}

interface StatusBadgeProps {
  label: string;
  tone: StatusTone;
  icon?: ReactNode;
  /** Semantic explanation surfaced to assistive tech. */
  title?: string;
  className?: string;
}

/**
 * Status badge rendered from the centralized status configuration.
 * Never communicates state by color alone — carries an icon and text (§45).
 */
export function StatusBadge({ label, tone, icon, title, className }: StatusBadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
        STATUS_TONE_CLASSES[tone],
        className
      )}
    >
      {icon}
      {label}
    </span>
  );
}
