'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/**
 * Server-side pagination control. Renders nothing when there is only one page.
 */
export function Pagination({ page, totalPages, total, pageSize, onPageChange, className }: PaginationProps) {
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const buttonClass =
    'inline-flex h-8.5 items-center gap-1 rounded-md border border-border bg-surface px-3 text-xs font-semibold text-foreground-muted transition-colors hover:border-border-strong hover:bg-surface-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';

  return (
    <nav className={cn('flex flex-wrap items-center justify-between gap-4 border-t border-border px-5 py-3', className)} aria-label="Pagination">
      <p className="text-xs text-foreground-muted tabular-nums" aria-live="polite">
        Showing <span className="font-semibold text-foreground">{from.toLocaleString()}–{to.toLocaleString()}</span> of{' '}
        <span className="font-semibold text-foreground">{total.toLocaleString()}</span>
      </p>
      <div className="flex items-center gap-2">
        <button type="button" className={buttonClass} onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          Previous
        </button>
        <span className="px-1.5 text-xs font-semibold text-foreground-muted tabular-nums">
          Page {page} of {totalPages}
        </span>
        <button type="button" className={buttonClass} onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
          Next
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </nav>
  );
}
