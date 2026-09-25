'use client';

import Link from 'next/link';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';

export type TrendDirection = 'up' | 'down' | 'flat';

export interface MetricCardProps {
  label: string;
  /** Pre-formatted value (formatGhs/formatCount outputs). */
  value: string;
  /** e.g. "12.4% vs yesterday" — rendered verbatim, no math here. */
  trend?: string;
  trendDirection?: TrendDirection;
  /** Comparison context, e.g. "compared with yesterday". */
  comparison?: string;
  icon?: React.ComponentType<{ className?: string }>;
  href?: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}

const TREND_STYLES: Record<TrendDirection, { icon: typeof Minus; classes: string }> = {
  up: { icon: ArrowUpRight, classes: 'text-success' },
  down: { icon: ArrowDownRight, classes: 'text-danger' },
  flat: { icon: Minus, classes: 'text-foreground-muted' },
};

/**
 * KPI card (§38). Trend text is displayed verbatim — the dashboard never
 * implies statistical significance from simple deltas.
 */
export function MetricCard({
  label,
  value,
  trend,
  trendDirection = 'flat',
  comparison,
  icon: Icon,
  href,
  loading,
  error,
  onRetry,
  className,
}: MetricCardProps) {
  const TrendIcon = TREND_STYLES[trendDirection].icon;

  const body = (
    <div
      className={cn(
        'flex h-full flex-col rounded-lg border border-border bg-surface p-5 transition-shadow',
        href && !loading && !error && 'hover:shadow-md focus:outline-none focus-visible:outline-2 focus-visible:outline-primary',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-label">{label}</p>
        {Icon && (
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-subtle text-primary">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        )}
      </div>

      {loading ? (
        <Skeleton className="mt-3 h-8 w-24" />
      ) : error ? (
        <p className="mt-3 text-sm text-danger">
          {error}
          {onRetry && (
            <button type="button" onClick={onRetry} className="ml-2 font-semibold underline focus:outline-none focus-visible:outline-2 focus-visible:outline-primary">
              Retry
            </button>
          )}
        </p>
      ) : (
        <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{value}</p>
      )}

      {!loading && !error && (trend || comparison) && (
        <p className="mt-1 flex items-center gap-1 text-xs text-foreground-muted">
          {trend && (
            <span className={cn('inline-flex items-center gap-0.5 font-semibold', TREND_STYLES[trendDirection].classes)}>
              <TrendIcon className="h-3 w-3" aria-hidden />
              {trend}
            </span>
          )}
          {comparison && <span>{trend ? ` ${comparison}` : comparison}</span>}
        </p>
      )}
    </div>
  );

  if (href && !loading && !error) {
    return (
      <Link href={href} className="block h-full rounded-lg focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        {body}
      </Link>
    );
  }
  return body;
}

/** Skeleton row of metric cards for whole-section loading (§48). */
export function MetricCardSkeletonRow({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4', className)}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="h-28 rounded-lg border border-border bg-surface p-5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-4 h-8 w-24" />
        </div>
      ))}
    </div>
  );
}
