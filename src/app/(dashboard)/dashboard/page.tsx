'use client';

/**
 * Operational command center (§2/§7).
 *
 * Every section is backed by a verified backend endpoint (§4/§6):
 * - Health → GET /health (measured truth; no fabricated services, §13)
 * - Attention → /admin/stats counts (permission-filtered drill-downs, §16/§19)
 * - Overview → /admin/stats + /admin/analytics/performance
 * - Finance → /admin/stats.total_revenue (labeled by definition, §37)
 * - Activity → /admin/audit-logs (human feed; audit system untouched, §47)
 *
 * No fake metrics (§5). Missing backend capabilities are documented in
 * docs/architecture/dashboard-capability-map.md, never simulated.
 */

import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  LifeBuoy,
  Package,
  RefreshCcw,
  ScrollText,
  ShieldCheck,
  Users,
  Video,
  Wallet,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ErrorState, TableSkeleton } from '@/components/ui/EmptyState';
import { MetricCard, MetricCardSkeletonRow } from '@/components/data-display/MetricCard';
import { ChartCard } from '@/components/data-display/ChartCard';
import { PlatformHealthCard } from '@/components/data-display/PlatformHealthCard';
import { useSystemStats, useRecentAuditLogs, usePerformance } from '@/features/dashboard/hooks';
import { usePlatformHealth } from '@/features/health/hooks';
import { useAuth } from '@/providers/AuthProvider';
import { formatGhs, formatCount } from '@/lib/formatting/money';
import { formatRelativeTime, formatOperationalDate } from '@/lib/formatting/dates';
import { isPermission, type Permission } from '@/lib/permissions';

/** §40: chart colors from the token layer. */
const CHART_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)'];
const TOOLTIP_STYLE = {
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--foreground)',
  fontSize: 12,
} as const;

const HEALTH_QUERY_KEY = ['health', 'platform'] as const;

export default function DashboardHomePage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();

  const stats = useSystemStats();
  const performance = usePerformance('24h');
  const activity = useRecentAuditLogs(8);
  const health = usePlatformHealth();

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin'] });
    void queryClient.invalidateQueries({ queryKey: HEALTH_QUERY_KEY });
  };

  const statsData = stats.data;
  const statsError = stats.error;

  // ── Attention items (§16/§18/§19): real counts, permission-filtered, ordered by urgency ──
  const attentionItems = statsData
    ? (
        [
          statsData.pending_verifications > 0 && {
            key: 'verifications',
            label: `${formatCount(statsData.pending_verifications)} partner verification${statsData.pending_verifications === 1 ? '' : 's'} pending`,
            href: '/verification',
            icon: ShieldCheck,
            permission: 'verification.read' as Permission,
          },
          statsData.total_disputes > 0 && {
            key: 'disputes',
            label: `${formatCount(statsData.total_disputes)} open dispute${statsData.total_disputes === 1 ? '' : 's'}`,
            href: '/support',
            icon: LifeBuoy,
            permission: 'support.read' as Permission,
          },
          statsData.active_consultations > 0 && {
            key: 'consultations',
            label: `${formatCount(statsData.active_consultations)} consultation${statsData.active_consultations === 1 ? '' : 's'} in progress`,
            href: '/consultations',
            icon: Video,
            permission: 'consultations.read' as Permission,
          },
        ].filter(Boolean) as Array<{
          key: string;
          label: string;
          href: string;
          icon: typeof Users;
          permission: Permission;
        }>
      ).filter((item) => isPermission(item.permission) && can(item.permission))
    : [];

  const partnerDistribution = statsData
    ? [
        { name: 'Doctors', value: statsData.total_doctors },
        { name: 'Laboratories', value: statsData.total_labs },
        { name: 'Pharmacies', value: statsData.total_pharmacies },
        { name: 'Patients', value: statsData.total_patients },
      ].filter((entry) => entry.value > 0)
    : [];

  const partnerTotal = partnerDistribution.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <div className="space-y-6">
      {/* ── Command header (§8) ── */}
      <PageHeader
        breadcrumbs={[{ label: 'Dashboard' }]}
        title="Operational overview"
        description={`${formatOperationalDate()} · Africa/Accra`}
        secondaryActions={
          <span className="hidden text-xs text-foreground-subtle sm:inline">
            {stats.isFetching
              ? 'Updating…'
              : stats.dataUpdatedAt
                ? `Updated ${formatRelativeTime(stats.dataUpdatedAt)}`
                : null}
          </span>
        }
        actions={
          <Button variant="outline" size="sm" onClick={refreshAll} disabled={stats.isFetching}>
            <RefreshCcw className={stats.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} aria-hidden />
            Refresh
            <span className="sr-only"> all dashboard data</span>
          </Button>
        }
      />

      {/* ── Health (§13) + Attention (§16) ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <PlatformHealthCard
          health={health.data}
          isLoading={health.isLoading}
          onRefresh={() => void health.refetch()}
        />

        <Card padding="none" className="overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <h2 className="text-section-heading">Attention required</h2>
            <span className="text-xs text-foreground-subtle">Authoritative counts</span>
          </div>
          {statsError ? (
            <ErrorState code={statsError.code} message={statsError.message} requestId={statsError.requestId} onRetry={refreshAll} />
          ) : stats.isLoading ? (
            <TableSkeleton rows={3} columns={1} />
          ) : attentionItems.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-foreground-subtle">
              Nothing requires immediate attention.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {attentionItems.map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    className="group flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-surface-muted focus:outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-warning-subtle text-warning">
                        <item.icon className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="truncate text-sm font-medium text-foreground">{item.label}</span>
                    </span>
                    <ArrowRight
                      className="h-4 w-4 shrink-0 text-border-strong transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* ── Platform overview (§27/§28/§36) ── */}
      {statsError ? null : stats.isLoading ? (
        <MetricCardSkeletonRow />
      ) : (
        statsData && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Patients"
              value={formatCount(statsData.total_patients)}
              comparison={`${formatCount(statsData.total_users)} total accounts`}
              icon={Users}
              href={can('users.read') ? '/users?role=patient' : undefined}
            />
            <MetricCard
              label="Active consultations"
              value={formatCount(statsData.active_consultations)}
              comparison={`${formatCount(statsData.total_consultations)} all time`}
              icon={Video}
              href="/consultations"
            />
            <MetricCard
              label="Pharmacy orders"
              value={formatCount(statsData.total_orders)}
              comparison="All time"
              icon={Package}
              href="/orders"
            />
            <MetricCard
              label="Gross payment volume"
              value={formatGhs(statsData.total_revenue)}
              comparison="Backend-authoritative total"
              icon={Wallet}
              href="/finance"
            />
          </div>
        )
      )}

      {/* ── Trends (§41/§42/§43) + Partner distribution (§29) ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title="Platform activity — last 24 hours"
          description="Registrations, consultations and orders from backend analytics."
          loading={performance.isLoading}
          error={
            performance.error
              ? {
                  code: performance.error.code,
                  message: performance.error.message,
                  requestId: performance.error.requestId,
                }
              : null
          }
          onRetry={() => void performance.refetch()}
          isEmpty={!performance.data || performance.data.data.length === 0}
          emptyTitle="No activity data"
          emptyDescription="No activity data for this period yet."
          heightClassName="h-64"
        >
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            minHeight={0}
            initialDimension={{ width: 520, height: 256 }}
          >
            <AreaChart data={performance.data?.data ?? []} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id="usersFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: 'var(--foreground-subtle)' }}
                dy={8}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: 'var(--foreground-subtle)' }}
                allowDecimals={false}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Area
                type="monotone"
                dataKey="users"
                name="Registrations"
                stroke="var(--chart-1)"
                strokeWidth={2}
                fill="url(#usersFill)"
              />
              <Area type="monotone" dataKey="consultations" name="Consultations" stroke="var(--chart-3)" strokeWidth={2} fillOpacity={0} />
              <Area type="monotone" dataKey="orders" name="Orders" stroke="var(--chart-2)" strokeWidth={2} fillOpacity={0} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <Card>
          <CardHeader title="Partner distribution" description="Verified roles across the platform." />
          <div className="mt-4 h-48">
            {partnerTotal > 0 ? (
              <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={0}
                minHeight={0}
                initialDimension={{ width: 320, height: 192 }}
              >
                <PieChart>
                  <Pie
                    data={partnerDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={4}
                    dataKey="value"
                    cornerRadius={4}
                  >
                    {partnerDistribution.map((entry, index) => (
                      <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-foreground-subtle">No data yet.</div>
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {partnerDistribution.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                <span className="text-xs font-semibold text-foreground-muted">{entry.name}</span>
                <span className="text-xs font-bold text-foreground">{formatCount(entry.value)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Recent activity (§45/§46/§47) ── */}
      <Card padding="none" className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-section-heading">Recent activity</h2>
          {isPermission('audit.read') && can('audit.read') && (
            <Link href="/audit-logs" className="text-xs font-semibold text-primary hover:underline">
              Open audit logs
            </Link>
          )}
        </div>
        {activity.isLoading ? (
          <TableSkeleton rows={5} columns={3} />
        ) : activity.error ? (
          <ErrorState code={activity.error.code} message={activity.error.message} onRetry={() => void activity.refetch()} />
        ) : activity.data && activity.data.length > 0 ? (
          <ul className="divide-y divide-border/60">
            {activity.data.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-4 px-6 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-muted text-foreground-subtle">
                    <ScrollText className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {entry.action.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
                    </p>
                    <p className="text-xs text-foreground-subtle">
                      {entry.target_type ?? 'System'}
                      {entry.target_id ? ` · ${entry.target_id.slice(0, 8)}…` : ''}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-xs text-foreground-subtle">{formatRelativeTime(entry.created_at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-6 py-10 text-center text-sm text-foreground-subtle">No recent activity.</div>
        )}
      </Card>
    </div>
  );
}
