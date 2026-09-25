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

/** Standard empty state for lists and tables. */
export function EmptyState({ icon: Icon = Inbox, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-16 text-center', className)}>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
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
 * explicit recovery action (§43). Never renders stack traces.
 */
export function ErrorState({ code, message, requestId, onRetry, className }: ErrorStateProps) {
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center px-6 py-16 text-center', className)}>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500">
        <RefreshCcw className="h-6 w-6" aria-hidden />
      </div>
      <p className="text-sm font-semibold text-slate-900">{code ? `${code.replaceAll('_', ' ')}` : 'Something went wrong'}</p>
      <p className="mt-1 max-w-md text-sm text-slate-500">{message}</p>
      {requestId && (
        <p className="mt-3 font-mono text-[11px] text-slate-400">
          Reference: <span className="select-text">{requestId}</span>
        </p>
      )}
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-5" onClick={onRetry}>
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
    <div className={cn('space-y-3 p-4', className)} aria-hidden>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div
              key={colIndex}
              className="h-9 flex-1 animate-pulse rounded-lg bg-slate-100"
              style={{ animationDelay: `${(rowIndex * columns + colIndex) * 40}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
