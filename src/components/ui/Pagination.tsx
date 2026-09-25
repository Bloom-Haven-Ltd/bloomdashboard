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
 * Server-side pagination control (§29/§44). Renders nothing when there is
 * only one page. Nav buttons are disabled appropriately and labeled for
 * screen readers.
 */
export function Pagination({ page, totalPages, total, pageSize, onPageChange, className }: PaginationProps) {
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const buttonClass =
    'inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';

  return (
    <nav className={cn('flex items-center justify-between gap-4 border-t border-slate-100 px-4 py-3', className)} aria-label="Pagination">
      <p className="text-xs text-slate-500" aria-live="polite">
        Showing <span className="font-semibold text-slate-700">{from.toLocaleString()}–{to.toLocaleString()}</span> of{' '}
        <span className="font-semibold text-slate-700">{total.toLocaleString()}</span>
      </p>
      <div className="flex items-center gap-2">
        <button type="button" className={buttonClass} onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Previous
        </button>
        <span className="px-1 text-xs font-semibold text-slate-500">
          Page {page} of {totalPages}
        </span>
        <button type="button" className={buttonClass} onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
          Next
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </nav>
  );
}
