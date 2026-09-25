'use client';

/**
 * Laboratory command center (§20) — live posture of booking operations from
 * authoritative feeds only. No admin KPI endpoint exists (audit PL-6), so
 * counters summarize the latest bookings page and say so (§64). Sample and
 * result pipelines are lab-scoped in the backend (audit PL-2) and are
 * represented as explicit capability notes, not fake queues.
 */

import Link from 'next/link';
import { useMemo } from 'react';
import { AlertTriangle, ArrowRight, FlaskConical, Microscope, TestTubes, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useLabBookings } from '@/features/laboratory/hooks';
import { formatGhs } from '@/lib/formatting/money';
import { formatRelativeTime } from '@/lib/formatting/dates';

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
  icon: typeof FlaskConical;
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

export default function LaboratoryOverviewPage() {
  const bookings = useLabBookings(1, 50);
  const items = useMemo(() => bookings.data?.items ?? [], [bookings.data]);

  const stats = useMemo(() => {
    const count = (states: string[]) => items.filter((b) => states.includes(b.status)).length;
    return {
      pending: count(['pending']),
      confirmed: count(['confirmed']),
      completed: count(['completed']),
      exceptions: count(['cancelled', 'no_show']),
      failedPayments: items.filter((b) => b.payment_status === 'failed').length,
      homeVisits: items.filter((b) => b.booking_type === 'home_service').length,
      collected: items
        .filter((b) => b.payment_status === 'paid')
        .reduce((sum, b) => sum + (b.amount ?? 0), 0),
    };
  }, [items]);

  const recent = items.slice(0, 6);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Operations' }, { label: 'Laboratory' }]}
        title="Laboratory operations"
        description="Live posture of bookings across partner laboratories. Collection, processing, and results are laboratory-scoped operations (audit PL-2); this command center observes what the backend exposes."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Awaiting confirmation"
          value={stats.pending}
          hint="New bookings pending with labs"
          icon={TestTubes}
          href="/lab-bookings"
        />
        <KpiCard
          label="Confirmed upcoming"
          value={stats.confirmed}
          hint="Scheduled and confirmed"
          icon={FlaskConical}
          href="/lab-bookings"
        />
        <KpiCard
          label="Completed"
          value={stats.completed}
          hint="Closed bookings"
          icon={Microscope}
          href="/lab-bookings"
        />
        <KpiCard
          label="Exceptions"
          value={stats.exceptions}
          hint="Cancelled or no-show"
          icon={AlertTriangle}
          href="/lab-bookings"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-foreground-subtle">
            <TestTubes className="h-3.5 w-3.5" aria-hidden />
            Home collections
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{stats.homeVisits}</p>
          <p className="mt-1 text-xs text-foreground-subtle">On the latest page — addresses are PII, never rendered</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-foreground-subtle">
            <XCircle className="h-3.5 w-3.5" aria-hidden />
            Failed payments
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{stats.failedPayments}</p>
          <p className="mt-1 text-xs text-foreground-subtle">Escalate to Finance</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-foreground-subtle">Collected on latest page</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{formatGhs(stats.collected)}</p>
          <p className="mt-1 text-xs text-foreground-subtle">Paid bookings only — backend-authoritative (§31)</p>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Sample & result pipelines"
          description="Not available to administrators — laboratory-scoped in the backend (audit PL-2)."
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-dashed border-border bg-neutral-subtle/40 p-4">
            <p className="text-sm font-semibold text-foreground">Samples</p>
            <p className="mt-1 text-xs text-foreground-muted">
              Collection, receipt, rejection, and recollection tracking exist in the backend with full audit events, but
              every endpoint requires the laboratory role. Admin visibility is a backend dependency (PL-2).
            </p>
          </div>
          <div className="rounded-lg border border-dashed border-border bg-neutral-subtle/40 p-4">
            <p className="text-sm font-semibold text-foreground">Results governance</p>
            <p className="mt-1 text-xs text-foreground-muted">
              Draft → review → validate → release workflow with immutable audit and versioning. Clinical content is
              doctor/patient-only by design (§26/§39). Admin visibility is a backend dependency (PL-2).
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Latest bookings"
          description="Most recent records from the authoritative feed."
          action={
            <Link href="/lab-bookings" className="inline-flex">
              <Button variant="outline" size="sm">
                Open booking center
              </Button>
            </Link>
          }
        />
        <ul className="divide-y divide-border">
          {recent.map((booking) => (
            <li key={booking.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div className="min-w-0">
                <p className="font-mono text-xs font-semibold text-foreground">{booking.id.slice(0, 8).toUpperCase()}</p>
                <p className="text-xs text-foreground-subtle">
                  {booking.status.replace('_', ' ')} · {formatRelativeTime(booking.booking_date)}
                </p>
              </div>
              <span className="text-sm font-semibold text-foreground">{formatGhs(booking.amount)}</span>
            </li>
          ))}
          {!recent.length && !bookings.isLoading && (
            <li className="py-3 text-sm text-foreground-subtle">No bookings recorded yet.</li>
          )}
        </ul>
      </Card>

      <p className="flex items-start gap-1.5 text-xs text-foreground-subtle">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        Counters summarize the latest 50 bookings from the feed, not the whole platform — the backend has no admin KPI
        endpoint yet (audit PL-6). Turnaround and rejection metrics require backend aggregation (§41).
      </p>
    </div>
  );
}
