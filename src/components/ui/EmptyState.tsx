import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Inbox, RefreshCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/** Standard empty state for lists, charts, and tables. */
export function EmptyState({ icon: Icon = Inbox, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <div className="mb-3.5 flex h-11 w-11 items-center justify-center rounded-lg bg-surface-muted text-foreground-subtle">
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs leading-relaxed text-foreground-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  /** ApiError code or short classification, e.g. FORBIDDEN. */
  code?: string;
  /** Admin-facing message (never stack traces). */
  message: string;
  requestId?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Standard error state with request-ID for support correlation and an
 * explicit recovery action. Never renders stack traces.
 */
export function ErrorState({ code, message, requestId, onRetry, className }: ErrorStateProps) {
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <div className="mb-3.5 flex h-11 w-11 items-center justify-center rounded-lg bg-danger-subtle text-danger">
        <RefreshCcw className="h-5 w-5" aria-hidden />
      </div>
      <p className="text-sm font-semibold text-foreground">{code ? `${code.replaceAll('_', ' ')}` : 'Something went wrong'}</p>
      <p className="mt-1 max-w-md text-xs leading-relaxed text-foreground-muted">{message}</p>
      {requestId && (
        <p className="mt-2.5 font-mono text-[11px] text-foreground-subtle">
          Reference: <span className="select-text">{requestId}</span>
        </p>
      )}
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          <RefreshCcw className="h-3.5 w-3.5" aria-hidden />
          Try again
        </Button>
      )}
    </div>
  );
}

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

/** Neutral loading skeleton for table bodies. */
export function TableSkeleton({ rows = 5, columns = 4, className }: TableSkeletonProps) {
  return (
    <div className={cn('space-y-3 p-5', className)} aria-hidden>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div
              key={colIndex}
              className="h-8 flex-1 animate-pulse rounded-md bg-surface-muted"
              style={{ animationDelay: `${(rowIndex * columns + colIndex) * 35}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
