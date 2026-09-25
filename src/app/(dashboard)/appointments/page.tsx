'use client';

/**
 * Appointment Center (§6/§7) — operational control layer over the consultation
 * lifecycle. Server-side pagination + status filtering (the only admin feed
 * filters the backend accepts — audit CG-2); remaining search is client-side
 * over the loaded page and labeled as such.
 *
 * Read-only by design (§10/§46, audit CG-1): the backend restricts lifecycle
 * mutations to consultation participants, so administrators observe and
 * coordinate — they never mutate clinical state from this dashboard.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Clock, Search, Video } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type DataTableColumn } from '@/components/data-display/DataTable';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useConsultations } from '@/features/consultations/hooks';
import { formatDateTime, formatRelativeTime } from '@/lib/formatting/dates';
import { formatGhs } from '@/lib/formatting/money';
import { consultationStatusConfig, getStatusConfig, paymentStatusConfig } from '@/constants/status';
import type { ConsultationFeedDto } from '@/lib/api/schemas';

/** Exactly the backend ConsultationStatus values (§9 — do not invent states). */
const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'ready', label: 'Ready' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'interrupted', label: 'Interrupted' },
  { value: 'documentation_pending', label: 'Documentation pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No-show' },
  { value: 'rescheduled', label: 'Rescheduled' },
];

const MODE_LABELS: Record<string, string> = {
  video: 'Video',
  audio: 'Audio',
  chat: 'Chat',
  in_person: 'In person',
};

export default function AppointmentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusParam = searchParams.get('status') ?? 'all';
  const pageParam = Number(searchParams.get('page') ?? '1');

  const [search, setSearch] = useState('');
  const status = STATUS_OPTIONS.some((option) => option.value === statusParam) ? statusParam : 'all';
  const page = Number.isInteger(pageParam) && pageParam >= 1 ? pageParam : 1;

  const query = useConsultations(page, 20, status);
  const items = useMemo(() => query.data?.items ?? [], [query.data]);

  const setParams = (next: { status?: string; page?: number }) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next.status !== undefined) params.set('status', next.status);
    if (next.page !== undefined && next.page > 1) params.set('page', String(next.page));
    if (next.page === 1) params.delete('page');
    router.replace(`/appointments?${params.toString()}`, { scroll: false });
  };

  // Client-side search over the loaded page — the admin feed has no search
  // parameter yet (audit CG-2). Debounced by nature of controlled input.
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (item) =>
        (item.patient_name?.toLowerCase().includes(needle) ?? false) ||
        item.id.toLowerCase().includes(needle) ||
        item.patient_id.toLowerCase().includes(needle) ||
        item.doctor_id.toLowerCase().includes(needle) ||
        (item.payment_reference?.toLowerCase().includes(needle) ?? false)
    );
  }, [items, search]);

  const columns: Array<DataTableColumn<ConsultationFeedDto>> = [
    {
      key: 'appointment',
      header: 'Appointment',
      cell: (item) => (
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold text-foreground">{item.id.slice(0, 8)}…</p>
          <p className="truncate text-xs text-foreground-muted">{item.patient_name ?? 'Patient'}</p>
        </div>
      ),
    },
    {
      key: 'schedule',
      header: 'Scheduled',
      hideBelow: 'sm',
      cell: (item) => (
        <div>
          <p className="text-foreground">{formatDateTime(item.date_time)}</p>
          <p className="text-xs text-foreground-subtle">{formatRelativeTime(item.date_time)}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (item) => {
        const config = getStatusConfig(consultationStatusConfig, item.status);
        return <StatusBadge label={config.label} tone={config.tone} title={config.meaning} />;
      },
    },
    {
      key: 'payment',
      header: 'Payment',
      hideBelow: 'sm',
      cell: (item) => {
        const config = getStatusConfig(paymentStatusConfig, item.payment_status);
        return <StatusBadge label={config.label} tone={config.tone} title={config.meaning} />;
      },
    },
    {
      key: 'type',
      header: 'Type',
      hideBelow: 'md',
      cell: (item) => (
        <div className="flex flex-col items-start gap-1">
          <Badge variant="neutral">{item.consultation_type}</Badge>
          <span className="text-[11px] text-foreground-subtle">{MODE_LABELS[item.consultation_mode] ?? item.consultation_mode}</span>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      hideBelow: 'lg',
      align: 'right',
      cell: (item) => <span className="font-semibold text-foreground">{formatGhs(item.amount)}</span>,
    },
    {
      key: 'actions',
      header: 'Review',
      align: 'right',
      cell: (item) => (
        <Link href={`/appointments/${item.id}`} className="inline-flex">
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
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Operations' }, { label: 'Appointments' }]}
        title="Appointments"
        description="Operational visibility across the consultation lifecycle. States are owned by patients and partners; this view observes and links."
      />

      <DataTable<ConsultationFeedDto>
        columns={columns}
        rows={filtered}
        getRowKey={(item) => item.id}
        page={query.data?.page}
        totalPages={query.data?.totalPages}
        total={query.data?.total}
        pageSize={20}
        onPageChange={(nextPage) => setParams({ page: nextPage })}
        loading={query.isLoading}
        error={
          query.error
            ? { code: query.error.code, message: query.error.message, requestId: query.error.requestId }
            : null
        }
        onRetry={() => void query.refetch()}
        emptyTitle="No appointments found"
        emptyDescription="No records match the current filters."
        toolbar={
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-56">
              <Input
                label="Search appointments"
                hideLabel
                placeholder="Search name, ID, payment ref…"
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
                onChange={(event) => setParams({ status: event.target.value, page: 1 })}
              />
            </div>
            <Link href="/telehealth" className="inline-flex">
              <Button variant="outline" size="sm">
                <Video className="h-4 w-4" aria-hidden />
                Telehealth board
              </Button>
            </Link>
          </div>
        }
      />

      <p className="flex items-center gap-1.5 text-xs text-foreground-subtle">
        <Clock className="h-3.5 w-3.5" aria-hidden />
        Server-side pagination and status filtering. Search operates on the loaded page until the backend adds a search
        parameter (audit CG-2). Administrative lifecycle actions require backend support (audit CG-1).
      </p>
    </div>
  );
}
