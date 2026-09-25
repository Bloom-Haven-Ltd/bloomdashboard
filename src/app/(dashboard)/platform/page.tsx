'use client';

/**
 * Platform command center (§6) — answers "is Bloom Haven Health operating
 * correctly right now" from exactly two authoritative sources:
 *  - GET /health (DB + Redis + version — audit PS-1)
 *  - GET /app/config (maintenance mode — §45)
 *
 * Everything the backend does not expose (per-integration health, jobs,
 * WebSocket metrics, API metrics) is rendered as an explicit "not exposed"
 * dependency note (§91: never infer; §64: never fake). Health polls every
 * 30 s; last-updated is always shown (§68).
 */

import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { MetricCard } from '@/components/data-display/MetricCard';
import { StatusBadge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { usePlatformHealth, useAppConfig } from '@/features/platform/hooks';
import { useQueryClient } from '@/hooks/useApiQuery';
import { formatDateTime, formatRelativeTime } from '@/lib/formatting/dates';

type HealthTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

function serviceTone(ok: boolean | undefined, loaded: boolean): { tone: HealthTone; label: string } {
  if (!loaded) return { tone: 'neutral', label: 'Unknown' };
  if (ok) return { tone: 'success', label: 'Operational' };
  return { tone: 'danger', label: 'Outage' };
}

export default function PlatformPage() {
  const health = usePlatformHealth({ refetchInterval: 30_000 });
  const appConfig = useAppConfig();
  const queryClient = useQueryClient();

  // Last successful fetch for the "last updated" indicator (§68).
  const lastUpdated = health.dataUpdatedAt ? new Date(health.dataUpdatedAt) : null;

  const db = serviceTone(health.data?.database, !health.isLoading && !health.isError);
  const redis = serviceTone(health.data?.redis, !health.isLoading && !health.isError);
  const overallLoaded = !health.isLoading && !health.isError;
  const overall = serviceTone(
    overallLoaded && health.data?.database && health.data?.redis,
    overallLoaded
  );

  const maintenance = appConfig.data?.maintenance_mode ?? false;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Platform' }]}
        title="Platform"
        description="Operational state of the platform. Health comes exclusively from the backend health endpoint — never inferred from this dashboard loading (§8)."
      />

      {health.isError ? (
        <Alert
          variant="danger"
          title="Platform health unavailable"
          description="The backend health endpoint could not be reached. This itself is an operational signal — the API may be down or unreachable from this network."
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Backend API"
          value={overall.label}
          comparison={health.data?.version ? `version ${health.data.version}` : 'health endpoint'}
          loading={health.isLoading}
          error={health.isError ? health.error.message : null}
          onRetry={() => void health.refetch()}
        />
        <MetricCard label="Database" value={db.label} comparison="SELECT 1 via health endpoint" loading={health.isLoading} />
        <MetricCard label="Redis" value={redis.label} comparison="PING via health endpoint" loading={health.isLoading} />
        <MetricCard
          label="Maintenance mode"
          value={maintenance ? 'Enabled' : 'Disabled'}
          comparison="backend remote config"
          loading={appConfig.isLoading}
        />
      </div>

      <Card>
        <CardHeader
          title="Core infrastructure"
          description="Backend-authoritative signals from GET /health."
          action={
            <button
              className="text-sm font-medium text-primary hover:underline"
              onClick={() => void health.refetch()}
            >
              Refresh
            </button>
          }
        />
        <div className="mt-3 space-y-2">
          {[
            { name: 'API', tone: overall.tone, label: overall.label, note: health.isError ? 'unreachable' : 'health endpoint responsive' },
            { name: 'PostgreSQL', tone: db.tone, label: db.label, note: 'SELECT 1' },
            { name: 'Redis', tone: redis.tone, label: redis.label, note: 'PING' },
          ].map((svc) => (
            <div key={svc.name} className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{svc.name}</p>
                <p className="text-xs text-foreground-muted">{svc.note}</p>
              </div>
              <StatusBadge label={svc.label} tone={svc.tone} title={svc.note} />
            </div>
          ))}
        </div>
      </Card>

      <Alert
        variant="info"
        title="What this dashboard deliberately does not show"
        description="Per-integration health (Firebase, Paystack, Agora, SMS), API metrics, background-job monitoring and WebSocket metrics are not exposed by backend endpoints (platform-audit.md PS-1/PS-6/PS-7/PS-9). They will appear here only when the backend exposes them — health is never inferred or simulated."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Operational surfaces" description="Audit, security lens and configuration." />
          <div className="mt-3 space-y-2 text-sm">
            <Link className="block font-medium text-primary hover:underline" href="/audit-logs">Audit log center →</Link>
            <Link className="block font-medium text-primary hover:underline" href="/platform/security">Security events (audit lens) →</Link>
            <Link className="block font-medium text-primary hover:underline" href="/platform/feature-flags">Feature flags (read-only) →</Link>
            <Link className="block font-medium text-primary hover:underline" href="/settings">System settings →</Link>
          </div>
        </Card>
        <Card>
          <CardHeader title="Signal freshness" description="No admin realtime channel exists (PS-6); signals poll." />
          <dl className="mt-2 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-foreground-muted">Health last updated</dt>
              <dd className="font-medium text-foreground">
                {lastUpdated ? `${formatRelativeTime(lastUpdated.toISOString())} (${formatDateTime(lastUpdated.toISOString())})` : '—'}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-foreground-muted">Maintenance message</dt>
              <dd className="max-w-[60%] text-right font-medium text-foreground">
                {appConfig.data?.maintenance_message ?? '—'}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-foreground-muted">Supported version range</dt>
              <dd className="font-medium text-foreground">
                {appConfig.data?.minimum_supported_version ?? '—'} – {appConfig.data?.latest_version ?? '—'}
              </dd>
            </div>
          </dl>
          <button
            className="mt-3 text-sm font-medium text-primary hover:underline"
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: ['platform'] });
            }}
          >
            Refresh all platform signals
          </button>
        </Card>
      </div>
    </div>
  );
}
