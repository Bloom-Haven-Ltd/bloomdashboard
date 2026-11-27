'use client';

import type { ReactNode } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';

export interface ChartCardProps {
  title: string;
  description?: string;
  action?: ReactNode;
  loading?: boolean;
  error?: { code?: string; message: string; requestId?: string } | null;
  onRetry?: () => void;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  heightClassName?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Standardized wrapper for analytics visualizations: consistent header,
 * loading placeholder, empty state, and error recovery.
 */
export function ChartCard({
  title,
  description,
  action,
  loading,
  error,
  onRetry,
  isEmpty,
  emptyTitle = 'No data available',
  emptyDescription = 'There is no recorded activity for this period yet.',
  heightClassName = 'h-64',
  className,
  children,
}: ChartCardProps) {
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader title={title} description={description} action={action} />
      <div className={cn('mt-5 w-full', heightClassName)}>
        {loading ? (
          <TableSkeleton rows={4} columns={1} className="p-0" />
        ) : error ? (
          <ErrorState
            code={error.code}
            message={error.message}
            requestId={error.requestId}
            onRetry={onRetry}
            className="h-full py-6"
          />
        ) : isEmpty ? (
          <EmptyState title={emptyTitle} description={emptyDescription} className="h-full py-6" />
        ) : (
          children
        )}
      </div>
    </Card>
  );
}
