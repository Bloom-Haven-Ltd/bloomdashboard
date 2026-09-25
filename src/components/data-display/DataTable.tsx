'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';

// ---------------------------------------------------------------------------
// Column model
// ---------------------------------------------------------------------------

export interface DataTableColumn<T> {
  /** Stable column key. */
  key: string;
  /** Column header text. */
  header: string;
  /** Cell renderer receiving the row. */
  cell: (row: T) => ReactNode;
  /** Visual width hint. */
  align?: 'left' | 'right';
  /** Column is hidden on small screens (§52). */
  hideBelow?: 'sm' | 'md' | 'lg';
  /** Accessible sort description when sortable. */
  sortable?: boolean;
  ariaSort?: 'ascending' | 'descending' | 'none';
}

export interface DataTableProps<T> {
  columns: Array<DataTableColumn<T>>;
  rows: T[];
  /** Stable row key. */
  getRowKey: (row: T) => string;
  /** First column rendered as a row header for screen readers. */
  rowHeaderKey?: string;

  // ── Server-side state (§30) ──
  page?: number;
  totalPages?: number;
  total?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;

  // ── States ──
  loading?: boolean;
  error?: { code?: string; message: string; requestId?: string } | null;
  onRetry?: () => void;
  emptyTitle: string;
  emptyDescription?: string;

  /** 'comfortable' (default) or 'compact' density (§32). */
  density?: 'comfortable' | 'compact';

  /** Optional toolbar (filters, search) rendered above the table. */
  toolbar?: ReactNode;
  className?: string;
}

const DENSITY_CLASSES = {
  comfortable: { row: 'px-6 py-4', head: 'px-6 py-3' },
  compact: { row: 'px-4 py-2.5', head: 'px-4 py-2' },
} as const;

const HIDE_BELOW: Record<NonNullable<DataTableColumn<unknown>['hideBelow']>, string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
};

/**
 * Enterprise data-table foundation (§29–§33): server-side pagination,
 * density control, slot-based columns, and standardized loading/empty/error
 * states. Sorting/filtering arrive with the backend query contracts in later
 * phases — the state model here is already server-driven, never client-side
 * mass fetching.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  loading,
  error,
  onRetry,
  emptyTitle,
  emptyDescription,
  density = 'comfortable',
  toolbar,
  className,
}: DataTableProps<T>) {
  const cell = DENSITY_CLASSES[density];

  if (error) {
    return (
      <Card padding="none" className={cn('overflow-hidden', className)}>
        <ErrorState
          code={error.code}
          message={error.message}
          requestId={error.requestId}
          onRetry={onRetry}
        />
      </Card>
    );
  }

  return (
    <Card padding="none" className={cn('overflow-hidden', className)}>
      {toolbar && <div className="border-b border-border p-4">{toolbar}</div>}

      {loading ? (
        <TableSkeleton rows={8} columns={Math.min(columns.length, 5)} />
      ) : rows.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted/60">
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={column.ariaSort}
                    className={cn(
                      'text-xs font-bold uppercase tracking-widest text-foreground-subtle',
                      cell.head,
                      column.align === 'right' && 'text-right',
                      column.hideBelow && HIDE_BELOW[column.hideBelow]
                    )}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.map((row) => (
                <tr key={getRowKey(row)} className="transition-colors hover:bg-surface-muted/50">
                  {columns.map((column, index) => (
                    <td
                      key={column.key}
                      className={cn(
                        cell.row,
                        column.align === 'right' && 'text-right',
                        column.hideBelow && HIDE_BELOW[column.hideBelow],
                        index === 0 && 'font-medium text-foreground'
                      )}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {onPageChange && total !== undefined && totalPages !== undefined && totalPages > 1 && !loading && !error && (
        <Pagination
          page={page ?? 1}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize ?? 20}
          onPageChange={onPageChange}
        />
      )}
    </Card>
  );
}
