'use client';

/**
 * Pharmacy command center (§7) — answers "what is happening with pharmacy
 * operations right now?" from authoritative feeds only. There are no
 * backend KPI endpoints for admins (audit PL-6), so counters are computed
 * over the most recent feed page and are labeled as such — no fabricated
 * metrics (§7.1/§64). Drills into the filtered order center (§43).
 */

import Link from 'next/link';
import { useMemo } from 'react';
import { AlertTriangle, ArrowRight, Package, Receipt, RotateCcw, Truck } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { usePharmacyOrders } from '@/features/pharmacy/hooks';
import { formatGhs } from '@/lib/formatting/money';
import { formatRelativeTime } from '@/lib/formatting/dates';

const ACTIVE_STATES = ['pending', 'confirmed', 'preparing', 'ready'] as const;
const TRANSIT_STATES = ['out_for_delivery', 'delivered'] as const;
const TERMINAL_BAD = ['cancelled', 'rejected', 'returned', 'failed'] as const;

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: typeof Package;
  href: string;
}) {
  return (
    <Link href={href} className="group block rounded-lg border border-border bg-surface p-4 transition-colors hover:border-primary/40">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-foreground-subtle">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
      <p className="mt-1 flex items-center gap-1 text-xs text-foreground-subtle">
        {hint}
        <ArrowRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
      </p>
    </Link>
  );
}

export default function PharmacyOverviewPage() {
  // Scope note: the backend exposes no admin KPI endpoint (PL-6) — these
  // counters summarize the latest orders page, not the whole platform.
  const orders = usePharmacyOrders(1, 50);
  const items = useMemo(() => orders.data?.items ?? [], [orders.data]);

  const stats = useMemo(() => {
    const count = (states: readonly string[]) => items.filter((o) => states.includes(o.status)).length;
    const payments = items.filter((o) => o.payment_status === 'paid').length;
    const revenue = items
      .filter((o) => o.payment_status === 'paid')
      .reduce((sum, o) => sum + (o.total_amount ?? 0), 0);
    return {
      active: count(ACTIVE_STATES),
      awaitingAcceptance: count(['pending']),
      preparing: count(['confirmed', 'preparing']),
      readyDispatch: count(['ready']),
      transit: count(TRANSIT_STATES),
      exceptions: count(TERMINAL_BAD),
      paymentFailed: items.filter((o) => o.payment_status === 'failed').length,
      payments,
      revenue,
    };
  }, [items]);

  const recent = items.slice(0, 6);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Operations' }, { label: 'Pharmacy' }]}
        title="Pharmacy operations"
        description="Live posture of order fulfillment across partner pharmacies. States are owned by partners; this command center observes and drills down."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Awaiting acceptance"
          value={stats.awaitingAcceptance}
          hint="Orders pending with pharmacies"
          icon={Package}
          href="/orders"
        />
        <KpiCard
          label="In preparation"
          value={stats.preparing}
          hint="Confirmed or preparing"
          icon={Package}
          href="/orders"
        />
        <KpiCard
          label="Ready / in transit"
          value={`${stats.readyDispatch} / ${stats.transit}`}
          hint="Packed or with delivery"
          icon={Truck}
          href="/orders"
        />
        <KpiCard
          label="Exceptions"
          value={stats.exceptions}
          hint="Cancelled, rejected, returned, failed"
          icon={AlertTriangle}
          href="/orders"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-foreground-subtle">
            <Receipt className="h-3.5 w-3.5" aria-hidden />
            Paid on latest page
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{stats.payments}</p>
          <p className="mt-1 text-xs text-foreground-subtle">Collected value {formatGhs(stats.revenue)}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-foreground-subtle">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            Failed payments
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{stats.paymentFailed}</p>
          <p className="mt-1 text-xs text-foreground-subtle">Escalate to Finance</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-foreground-subtle">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Retry candidates
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {items.filter((o) => o.status === 'failed').length}
          </p>
          <p className="mt-1 text-xs text-foreground-subtle">Failed orders may retry (failed → pending)</p>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Latest orders"
          description="Most recent records from the authoritative feed."
          action={
            <Link href="/orders" className="inline-flex">
              <Button variant="outline" size="sm">
                Open order center
              </Button>
            </Link>
          }
        />
        <ul className="divide-y divide-border">
          {recent.map((order) => (
            <li key={order.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div className="min-w-0">
                <p className="font-mono text-xs font-semibold text-foreground">{order.id.slice(0, 8).toUpperCase()}</p>
                <p className="text-xs text-foreground-subtle">
                  {order.status.replace('_', ' ')} · {formatRelativeTime(order.created_at)}
                </p>
              </div>
              <span className="text-sm font-semibold text-foreground">{formatGhs(order.total_amount)}</span>
            </li>
          ))}
          {!recent.length && !orders.isLoading && (
            <li className="py-3 text-sm text-foreground-subtle">No orders recorded yet.</li>
          )}
        </ul>
      </Card>

      <p className="flex items-start gap-1.5 text-xs text-foreground-subtle">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        Counters summarize the latest 50 orders from the feed, not the whole platform — the backend has no admin KPI
        endpoint yet (audit PL-6). Unavailable metrics are never fabricated (§7.1/§64). Per-pharmacy performance
        (acceptance, rejection, delivery rates) requires backend aggregation (§41).
      </p>
    </div>
  );
}
