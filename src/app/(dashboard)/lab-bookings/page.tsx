'use client';

/**
 * Laboratory booking center (§21) — read-only operational feed over
 * /admin/lab-bookings (pagination only, audit PL-12). Tests arrive via the
 * embedded request; patient demographics embedded by the backend are stripped
 * at the parse boundary (audit PL-3). Sample/result drill-downs require
 * backend access changes (audit PL-2).
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Search } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type DataTableColumn } from '@/components/data-display/DataTable';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useLabBookings } from '@/features/laboratory/hooks';
import { formatDateTime, formatRelativeTime } from '@/lib/formatting/dates';
import { formatGhs } from '@/lib/formatting/money';
import { getStatusConfig, labBookingStatusConfig, paymentStatusConfig } from '@/constants/status';
import type { LabBookingFeedDto } from '@/lib/api/schemas';

const TYPE_LABELS: Record<string, string> = {
  walk_in: 'Walk-in',
  home_service: 'Home service',
};


export default function LabBookingsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const query = useLabBookings(page, 20);
  const items = useMemo(() => query.data?.items ?? [], [query.data]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (booking) =>
        booking.id.toLowerCase().includes(needle) ||
        booking.patient_id.toLowerCase().includes(needle) ||
        booking.lab_id.toLowerCase().includes(needle) ||
        (booking.payment_reference?.toLowerCase().includes(needle) ?? false)
    );
  }, [items, search]);

  const columns: Array<DataTableColumn<LabBookingFeedDto>> = [
    {
      key: 'booking',
      header: 'Booking',
      cell: (booking) => (
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold text-foreground">{booking.id.slice(0, 8).toUpperCase()}</p>
          <p className="truncate text-xs text-foreground-subtle">{TYPE_LABELS[booking.booking_type] ?? booking.booking_type}</p>
        </div>
      ),
    },
    {
      key: 'tests',
      header: 'Tests',
      hideBelow: 'md',
      cell: (booking) => {
        const tests = booking.request?.tests ?? [];
        if (!tests.length) return <span className="text-foreground-subtle">—</span>;
        return (
          <div className="flex max-w-56 flex-wrap gap-1">
            {tests.slice(0, 3).map((test) => (
              <Badge key={test} variant="neutral">
                {test}
              </Badge>
            ))}
            {tests.length > 3 && <Badge variant="neutral">+{tests.length - 3}</Badge>}
          </div>
        );
      },
    },
    {
      key: 'scheduled',
      header: 'Scheduled',
      hideBelow: 'sm',
      cell: (booking) => (
        <div>
          <p className="text-foreground-muted">{formatDateTime(booking.booking_date)}</p>
          <p className="text-xs text-foreground-subtle">{formatRelativeTime(booking.booking_date)}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (booking) => {
        const statusConfig = getStatusConfig(labBookingStatusConfig, booking.status);
        return <StatusBadge label={statusConfig.label} tone={statusConfig.tone} title={statusConfig.meaning} />;
      },
    },
    {
      key: 'flags',
      header: 'Flags',
      hideBelow: 'lg',
      cell: (booking) => {
        const flags: string[] = [];
        if (booking.status === 'no_show') flags.push('No-show');
        if (booking.status === 'cancelled') flags.push('Cancelled');
        if (booking.payment_status === 'failed') flags.push('Payment failed');
        if (booking.booking_type === 'home_service') flags.push('Home visit');
        if (!flags.length) return <span className="text-foreground-subtle">—</span>;
        return (
          <div className="flex flex-col items-start gap-1">
            {flags.map((flag) => (
              <Badge key={flag} variant={flag === 'Payment failed' || flag === 'No-show' ? 'danger' : 'warning'}>
                {flag}
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      key: 'payment',
      header: 'Payment',
      hideBelow: 'sm',
      cell: (booking) => {
        const paymentConfig = getStatusConfig(paymentStatusConfig, booking.payment_status);
        return <StatusBadge label={paymentConfig.label} tone={paymentConfig.tone} title={paymentConfig.meaning} />;
      },
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      cell: (booking) => <span className="font-semibold text-foreground">{formatGhs(booking.amount)}</span>,
    },
    {
      key: 'actions',
      header: 'Related',
      align: 'right',
      cell: (booking) => (
        <div className="flex justify-end gap-1.5">
          <Link href={`/users/${booking.patient_id}`} className="inline-flex">
            <Button variant="ghost" size="sm">
              Patient
            </Button>
          </Link>
          <Link href={`/partners/lab/${booking.lab_id}`} className="inline-flex">
            <Button variant="ghost" size="sm">
              Lab
            </Button>
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Operations' }, { label: 'Laboratory', href: '/laboratory' }, { label: 'Bookings' }]}
        title="Laboratory bookings"
        description="Sample collection and processing pipeline across partner laboratories. Samples and results are laboratory-scoped in the backend (audit PL-2)."
      />

      <DataTable<LabBookingFeedDto>
        columns={columns}
        rows={filtered}
        getRowKey={(booking) => booking.id}
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
        emptyTitle="No lab bookings"
        emptyDescription="Bookings will appear here as patients schedule tests."
        toolbar={
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-64">
              <Input
                label="Search bookings"
                hideLabel
                placeholder="Search ID, patient, payment ref… (loaded page)"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                leadingIcon={<Search className="h-4 w-4" aria-hidden />}
                type="search"
              />
            </div>
          </div>
        }
      />

      <p className="flex items-start gap-1.5 text-xs text-foreground-subtle">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        Server-side pagination only (audit PL-12); search runs on the loaded page. Patient contact details embedded by
        the backend are removed before rendering (audit PL-3). Booking status changes are not transition-validated
        server-side — states render as reported (see lab-operations-state-machine.md).
      </p>
    </div>
  );
}
