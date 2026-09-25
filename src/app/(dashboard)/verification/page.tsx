'use client';

/**
 * Verification Center (§6/§7/§8/§66) — command center plus the pending queue.
 *
 * Grounded in the Phase 6 audit (docs/admin/trust-safety-audit.md): the
 * backend exposes a single boolean-verification queue — there are no
 * UNDER_REVIEW / NEEDS_CORRECTION / EXPIRING / RISK states, so this page
 * renders only Pending and says why nothing else exists. Decisions are made
 * on the per-entry review page; the backend authorizes and audits every one.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Clock, FileClock, Search, ShieldCheck, Stethoscope, FlaskConical, Building2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type DataTableColumn } from '@/components/data-display/DataTable';
import { MetricCard, MetricCardSkeletonRow } from '@/components/data-display/MetricCard';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useSystemStats } from '@/features/dashboard/hooks';
import { usePendingVerifications } from '@/features/verification/hooks';
import { formatDateTime } from '@/lib/formatting/dates';
import { isPermission } from '@/lib/permissions';
import { useAuth } from '@/providers/AuthProvider';
import type { PendingVerificationDto } from '@/lib/api/schemas';

type TypeFilter = 'all' | 'doctor' | 'lab' | 'pharmacy';

const ROLE_META: Record<string, { label: string; icon: typeof Stethoscope }> = {
  doctor: { label: 'Doctor', icon: Stethoscope },
  lab: { label: 'Laboratory', icon: FlaskConical },
  pharmacy: { label: 'Pharmacy', icon: Building2 },
};

export default function VerificationPage() {
  const { can } = useAuth();
  const stats = useSystemStats();
  const queue = usePendingVerifications();

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [search, setSearch] = useState('');

  const items = useMemo(() => queue.data ?? [], [queue.data]);

  const counts = useMemo(() => {
    const byType: Record<string, number> = { doctor: 0, lab: 0, pharmacy: 0 };
    for (const entry of items) byType[entry.role] = (byType[entry.role] ?? 0) + 1;
    return byType;
  }, [items]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter((entry) => {
      if (typeFilter !== 'all' && entry.role !== typeFilter) return false;
      if (!needle) return true;
      return (
        entry.name.toLowerCase().includes(needle) ||
        entry.display_name.toLowerCase().includes(needle) ||
        entry.email.toLowerCase().includes(needle) ||
        entry.id.toLowerCase().includes(needle) ||
        entry.user_id.toLowerCase().includes(needle) ||
        (entry.license_number?.toLowerCase().includes(needle) ?? false)
      );
    });
  }, [items, typeFilter, search]);

  const canReview = isPermission('verification.review') && can('verification.review');

  const columns: Array<DataTableColumn<PendingVerificationDto>> = [
    {
      key: 'partner',
      header: 'Applicant',
      cell: (item) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">{item.display_name}</p>
          <p className="truncate text-xs text-foreground-muted">{item.email}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      hideBelow: 'sm',
      cell: (item) => {
        const meta = ROLE_META[item.role];
        const Icon = meta?.icon ?? ShieldCheck;
        return (
          <Badge variant="primary">
            <Icon className="h-3 w-3" aria-hidden />
            {meta?.label ?? item.role}
          </Badge>
        );
      },
    },
    {
      key: 'license',
      header: 'License',
      hideBelow: 'md',
      cell: (item) => <span className="font-mono text-xs text-foreground-muted">{item.license_number ?? '—'}</span>,
    },
    {
      key: 'submitted',
      header: 'Submitted',
      hideBelow: 'md',
      cell: (item) => <span className="text-foreground-muted">{formatDateTime(item.created_at)}</span>,
    },
    {
      key: 'actions',
      header: 'Review',
      align: 'right',
      cell: (item) =>
        canReview ? (
          <Link href={`/verification/${item.id}`} className="inline-flex">
            <Button variant="outline" size="sm">
              Open review
            </Button>
          </Link>
        ) : (
          <span className="text-xs text-foreground-subtle">Read-only</span>
        ),
    },
  ];

  const hasFilters = typeFilter !== 'all' || search.trim().length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Trust & Safety' }, { label: 'Verification' }]}
        title="Verification Center"
        description="Partner credential review. Every decision is authorized and audited by the backend."
      />

      {/* Command center (§7) — only backend-computable metrics. */}
      {queue.error ? (
        <Card>
          <p className="text-sm text-danger">
            Operational metrics are unavailable: {queue.error.message}
          </p>
        </Card>
      ) : stats.isLoading || queue.isLoading ? (
        <MetricCardSkeletonRow count={4} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Pending reviews"
            value={String(stats.data?.pending_verifications ?? items.length)}
            icon={Clock}
            href="/verification"
          />
          <MetricCard label="Doctors waiting" value={String(counts.doctor ?? 0)} icon={Stethoscope} />
          <MetricCard label="Laboratories waiting" value={String(counts.lab ?? 0)} icon={FlaskConical} />
          <MetricCard label="Pharmacies waiting" value={String(counts.pharmacy ?? 0)} icon={Building2} />
        </div>
      )}

      <Alert
        variant="info"
        title="Supported categories"
        description="The platform currently supports a single Pending review stage. Needs-correction, expiring/expired-document, and risk queues require backend capabilities that do not exist yet (dependency register BG-1…BG-13 in docs/admin/trust-safety-audit.md). This page will grow those categories only when the backend adds the states."
      />

      {/* Queue filters (§8/§9) — client-side over the authoritative array
          until the backend accepts filter parameters (audit BG-10). */}
      <Card>
        <CardHeader
          title="Pending review queue"
          description="Client-side filtering over the backend queue. Search covers name, email, license, and IDs."
        />
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_13rem]">
          <Input
            label="Search queue"
            hideLabel
            placeholder="Search name, email, license, ID…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            leadingIcon={<Search className="h-4 w-4" aria-hidden />}
            type="search"
          />
          <Select
            label="Partner type"
            hideLabel
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
            options={[
              { value: 'all', label: 'All types' },
              { value: 'doctor', label: 'Doctors' },
              { value: 'lab', label: 'Laboratories' },
              { value: 'pharmacy', label: 'Pharmacies' },
            ]}
          />
        </div>

        <DataTable<PendingVerificationDto>
          columns={columns}
          rows={filtered}
          getRowKey={(item) => item.id}
          loading={queue.isLoading}
          error={
            queue.error
              ? { code: queue.error.code, message: queue.error.message, requestId: queue.error.requestId }
              : null
          }
          onRetry={() => void queue.refetch()}
          emptyTitle={hasFilters ? 'No matching applicants' : 'Verification queue is clear'}
          emptyDescription={
            hasFilters
              ? 'No pending submissions match the current filters.'
              : 'No partners are awaiting review right now.'
          }
        />

        {queue.isFetching && !queue.isLoading && (
          <p className="px-1 pt-2 text-xs text-foreground-subtle" aria-live="polite">
            Refreshing from the backend…
          </p>
        )}
      </Card>

      {/* Review history lives in the audit trail (§28) — queue entries carry
          no timeline backend-side (audit BG-10). */}
      <p className="flex items-center gap-1.5 text-xs text-foreground-subtle">
        <FileClock className="h-3.5 w-3.5" aria-hidden />
        Decision history is recorded in the audit trail (action <code className="font-mono">VERIFY_PROVIDER</code>) —
        see Audit Logs.
      </p>
    </div>
  );
}
