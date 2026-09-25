'use client';

import { CircleCheck, CircleDashed, CircleX, MinusCircle, RefreshCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  HEALTH_SERVICES,
  HEALTH_STATE_CONFIG,
  type HealthState,
} from '@/constants/health';
import { formatRelativeTime } from '@/lib/formatting/dates';
import type { PlatformHealth } from '@/features/health/service';

const STATE_ICON = {
  success: CircleCheck,
  warning: MinusCircle,
  danger: CircleX,
  neutral: CircleDashed,
} as const;

const STATE_CLASSES = {
  success: 'bg-success-subtle text-success ring-success/20',
  warning: 'bg-warning-subtle text-warning ring-warning/20',
  danger: 'bg-danger-subtle text-danger ring-danger/20',
  neutral: 'bg-neutral-subtle text-foreground-muted ring-border',
} as const;

function serviceState(state: PlatformHealth | undefined, key: 'api' | 'database' | 'redis'): HealthState {
  if (!state) return 'UNKNOWN';
  if (key === 'api') {
    return state.reachable && state.status === 'healthy'
      ? 'OPERATIONAL'
      : state.reachable
        ? 'DEGRADED'
        : 'OUTAGE';
  }
  const value = key === 'database' ? state.database : state.redis;
  if (value === null) return state.reachable ? 'UNKNOWN' : 'OUTAGE';
  return value ? 'OPERATIONAL' : 'OUTAGE';
}

function HealthPill({ state }: { state: HealthState }) {
  const config = HEALTH_STATE_CONFIG[state];
  const Icon = STATE_ICON[config.tone];
  return (
    <span
      title={config.meaning}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
        STATE_CLASSES[config.tone]
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {config.label}
    </span>
  );
}

export interface PlatformHealthCardProps {
  health: PlatformHealth | undefined;
  isLoading: boolean;
  onRefresh: () => void;
  className?: string;
}

/**
 * Platform health (§13–§15): one row per *measurable* service, overall state,
 * and the probe time. No fabricated services, no infrastructure internals.
 */
export function PlatformHealthCard({ health, isLoading, onRefresh, className }: PlatformHealthCardProps) {
  const states = HEALTH_SERVICES.map((service) => ({
    ...service,
    state: serviceState(health, service.key),
  }));

  const overall: HealthState = states.some((s) => s.state === 'OUTAGE')
    ? 'OUTAGE'
    : states.some((s) => s.state === 'DEGRADED')
      ? 'DEGRADED'
      : states.every((s) => s.state === 'OPERATIONAL')
        ? 'OPERATIONAL'
        : 'UNKNOWN';

  return (
    <div className={cn('rounded-lg border border-border bg-surface', className)}>
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div className="min-w-0">
          <h2 className="text-section-heading">Platform health</h2>
          <p className="mt-0.5 text-xs text-foreground-muted">
            {isLoading
              ? 'Checking…'
              : health
                ? `Last checked ${formatRelativeTime(health.checkedAt)}${health.version ? ` · backend v${health.version}` : ''}`
                : 'No signal'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <HealthPill state={overall} />
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-md p-1.5 text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground focus:outline-none focus-visible:outline-2 focus-visible:outline-primary"
            aria-label="Refresh platform health"
          >
            <RefreshCcw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} aria-hidden />
          </button>
        </div>
      </div>
      <ul className="divide-y divide-border/60">
        {states.map((service) => (
          <li key={service.key} className="flex items-center justify-between gap-4 px-5 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{service.label}</p>
              <p className="truncate text-xs text-foreground-subtle">{service.description}</p>
            </div>
            <HealthPill state={service.state} />
          </li>
        ))}
      </ul>
    </div>
  );
}
