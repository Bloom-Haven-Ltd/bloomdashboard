'use client';

/**
 * Prescription operations center (§12) — read-only monitoring of the
 * prescription workflow. The admin role bypasses the prescription access
 * check in the backend service (audit PL-5), so this feed is authoritative.
 * Clinical content (diagnosis, per-medication instructions) is parsed only in
 * the detail schema and rendered only behind `prescriptions.clinical` (§13).
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Search } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type DataTableColumn } from '@/components/data-display/DataTable';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { usePrescriptions } from '@/features/pharmacy/hooks';
import { formatDateTime, formatRelativeTime } from '@/lib/formatting/dates';
import { getStatusConfig, prescriptionStatusConfig } from '@/constants/status';
import type { PrescriptionFeedDto } from '@/lib/api/schemas';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'sent_to_pharmacy', label: 'Sent to pharmacy' },
  { value: 'approved', label: 'Approved' },
  { value: 'fulfilled', label: 'Fulfilled' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function PrescriptionsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const query = usePrescriptions(page, 20);
  const items = useMemo(() => query.data?.items ?? [], [query.data]);

  // Client-side search + status filter over the loaded page — the backend
  // list accepts only page/page_size/patient_id (audit PL-12).
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter((rx) => {
      if (status !== 'all' && rx.status !== status) return false;
      if (!needle) return true;
      return (
        rx.id.toLowerCase().includes(needle) ||
        rx.patient_id.toLowerCase().includes(needle) ||
        rx.doctor_id.toLowerCase().includes(needle) ||
        rx.consultation_id.toLowerCase().includes(needle) ||
        rx.medications.some((m) => m.medication_name.toLowerCase().includes(needle))
      );
    });
  }, [items, search, status]);

  const columns: Array<DataTableColumn<PrescriptionFeedDto>> = [
    {
      key: 'prescription',
      header: 'Prescription',
      cell: (rx) => (
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold text-foreground">{rx.id.slice(0, 8).toUpperCase()}</p>
          <p className="truncate text-xs text-foreground-subtle">
            {rx.medications.length === 1
              ? rx.medications[0].medication_name
              : `${rx.medications.length} medications`}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (rx) => {
        const config = getStatusConfig(prescriptionStatusConfig, rx.status);
        return <StatusBadge label={config.label} tone={config.tone} title={config.meaning} />;
      },
    },
    {
      key: 'flags',
      header: 'Flags',
      hideBelow: 'md',
      cell: (rx) => {
        const flags: string[] = [];
        if (rx.status === 'pending') flags.push('Awaiting routing');
        if (!rx.pharmacy_id) flags.push('No pharmacy');
        if (rx.fulfilled_at) flags.push('Fulfilled');
        if (!flags.length) return <span className="text-foreground-subtle">—</span>;
        return (
          <div className="flex flex-col items-start gap-1">
            {flags.map((flag) => (
              <Badge key={flag} variant={flag === 'No pharmacy' ? 'warning' : 'neutral'}>
                {flag}
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      key: 'pharmacy',
      header: 'Pharmacy',
      hideBelow: 'sm',
      cell: (rx) =>
        rx.pharmacy_id ? (
          <Link href={`/partners/pharmacy/${rx.pharmacy_id}`} className="inline-flex">
            <Button variant="ghost" size="xs">
              View
            </Button>
          </Link>
        ) : (
          <span className="text-foreground-subtle">—</span>
        ),
    },
    {
      key: 'consultation',
      header: 'Consultation',
      hideBelow: 'lg',
      cell: (rx) => (
        <Link href={`/appointments/${rx.consultation_id}`} className="inline-flex">
          <Button variant="ghost" size="xs">
            Open
          </Button>
        </Link>
      ),
    },
    {
      key: 'created',
      header: 'Created',
      hideBelow: 'lg',
      cell: (rx) => (
        <div>
          <p className="text-foreground-muted">{formatDateTime(rx.created_at)}</p>
          <p className="text-xs text-foreground-subtle">{formatRelativeTime(rx.created_at)}</p>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Review',
      align: 'right',
      cell: (rx) => (
        <Link href={`/prescriptions/${rx.id}`} className="inline-flex">
          <Button variant="outline" size="sm">
            Open
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Operations' }, { label: 'Pharmacy', href: '/pharmacy' }, { label: 'Prescriptions' }]}
        title="Prescriptions"
        description="Monitoring of the prescription workflow from issuance to fulfillment. Clinical content is permission-gated (§13)."
      />

      <DataTable<PrescriptionFeedDto>
        columns={columns}
        rows={filtered}
        getRowKey={(rx) => rx.id}
        page={query.data?.page}
        totalPages={query.data?.totalPages}
        total={query.data?.total}
        pageSize={20}
        onPageChange={setPage}
        loading={query.isLoading}
        error={
          query.error
            ? { code: query.error.code, message: query.error.message, requestId: query.error.requestId }
            : null
        }
        onRetry={() => void query.refetch()}
        emptyTitle="No prescriptions found"
        emptyDescription="Prescriptions will appear here as clinicians issue them."
        toolbar={
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-64">
              <Input
                label="Search prescriptions"
                hideLabel
                placeholder="Search ID, patient, medication… (loaded page)"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                leadingIcon={<Search className="h-4 w-4" aria-hidden />}
                type="search"
              />
            </div>
            <div className="w-48">
              <Select
                label="Filter by status"
                hideLabel
                options={STATUS_OPTIONS}
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
        }
      />

      <p className="flex items-start gap-1.5 text-xs text-foreground-subtle">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        Server-side pagination only; search and status filtering run on the loaded page (audit PL-12). Fulfillment
        status changes belong to the pharmacy partner app (§12) — no actions are offered here. Diagnosis and medication
        instructions are visible only on the detail record with clinical permission (§13).
      </p>
    </div>
  );
}
