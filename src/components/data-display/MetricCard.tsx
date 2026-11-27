'use client';

import Link from 'next/link';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';
import { MOTION_EASE } from '@/lib/motion';

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
  /** Restrained accent tone for the icon badge. */
  tone?: 'primary' | 'secondary' | 'neutral';
  href?: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}

const TREND_STYLES: Record<TrendDirection, { icon: typeof Minus; classes: string }> = {
  up: { icon: ArrowUpRight, classes: 'text-success bg-success-subtle' },
  down: { icon: ArrowDownRight, classes: 'text-danger bg-danger-subtle' },
  flat: { icon: Minus, classes: 'text-foreground-muted bg-surface-muted' },
};

const ICON_TONE_CLASSES: Record<NonNullable<MetricCardProps['tone']>, string> = {
  primary: 'bg-primary-subtle text-primary',
  secondary: 'bg-secondary-subtle text-warning',
  neutral: 'bg-surface-muted text-foreground-muted',
};

/**
 * Enterprise KPI card: restrained elevation, border color transition on hover,
 * tabular numbers, and accessible drill-down link.
 */
export function MetricCard({
  label,
  value,
  trend,
  trendDirection = 'flat',
  comparison,
  icon: Icon,
  tone = 'primary',
  href,
  loading,
  error,
  onRetry,
  className,
}: MetricCardProps) {
  const TrendIcon = TREND_STYLES[trendDirection].icon;

  const body = (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: MOTION_EASE }}
      className={cn(
        'group flex h-full flex-col justify-between rounded-lg border border-border bg-surface p-5 shadow-sm transition-all duration-150',
        href && !loading && !error && 'hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-label pt-0.5">{label}</p>
        {Icon && (
          <span
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors',
              ICON_TONE_CLASSES[tone]
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        )}
      </div>

      <div className="mt-3">
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : error ? (
          <p className="text-sm text-danger">
            {error}
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="ml-2 font-semibold underline focus:outline-none focus-visible:outline-2 focus-visible:outline-primary"
              >
                Retry
              </button>
            )}
          </p>
        ) : (
          <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">{value}</p>
        )}

        {!loading && !error && (trend || comparison) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-foreground-muted">
            {trend && (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 rounded-pill px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
                  TREND_STYLES[trendDirection].classes
                )}
              >
                <TrendIcon className="h-3 w-3" aria-hidden />
                {trend}
              </span>
            )}
            {comparison && <span className="truncate">{comparison}</span>}
          </div>
        )}
      </div>
    </motion.div>
  );

  if (href && !loading && !error) {
    return (
      <Link
        href={href}
        className="block h-full rounded-lg focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {body}
      </Link>
    );
  }
  return body;
}

/** Skeleton row of metric cards for whole-section loading. */
export function MetricCardSkeletonRow({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4', className)}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="h-30 rounded-lg border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
          <Skeleton className="mt-4 h-7 w-28" />
          <Skeleton className="mt-2.5 h-3 w-32" />
        </div>
      ))}
    </div>
  );
}
