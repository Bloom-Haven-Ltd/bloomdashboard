'use client';

/**
 * Payment center (§11/§12) — authoritative payments feed (admins see all
 * rows). Filters are limited to status + service type because that is the
 * entire backend query surface (audit §4); search/date/amount filters would
 * be fabricated capability and are not rendered (§64 no fake data).
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type DataTableColumn } from '@/components/data-display/DataTable';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { usePayments } from '@/features/finance/hooks';
import { formatDateTime } from '@/lib/formatting/dates';
import { formatGhs } from '@/lib/formatting/money';
import { getStatusConfig, paymentStatusConfig } from '@/constants/status';
import type { PaymentListItemDto } from '@/lib/api/schemas';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'INITIATED', label: 'Initiated' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'SUCCESS', label: 'Successful' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'ABANDONED', label: 'Abandoned' },
  { value: 'REVERSED', label: 'Reversed' },
  { value: 'REFUNDED', label: 'Refunded' },
  { value: 'PARTIALLY_REFUNDED', label: 'Partially refunded' },
];

const SERVICE_TYPE_OPTIONS = [
  { value: 'all', label: 'All service types' },
  { value: 'CONSULTATION', label: 'Consultations' },
  { value: 'LAB_BOOKING', label: 'Lab bookings' },
  { value: 'PHARMACY_ORDER', label: 'Pharmacy orders' },
  { value: 'PHARMACY_SUBSCRIPTION', label: 'Pharmacy subscriptions' },
  { value: 'LAB_SUBSCRIPTION', label: 'Lab subscriptions' },
];

export default function PaymentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get('status') ?? 'all';
  const serviceType = searchParams.get('service_type') ?? 'all';
  const page = Number(searchParams.get('page') ?? '1') || 1;
  const [pageSize] = useState(20);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'all' || (key === 'page' && value === '1')) next.delete(key);
    else next.set(key, value);
    router.replace(`/finance/payments${next.size ? `?${next.toString()}` : ''}`);
  };

  const query = usePayments(page, pageSize, status, serviceType, { refetchInterval: 30_000 });
  const items = query.data?.items ?? [];

  const columns: Array<DataTableColumn<PaymentListItemDto>> = [
    {
      key: 'reference',
      header: 'Payment',
      cell: (payment) => (
        <div>
          <Link href={`/finance/payments/${payment.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">
            {payment.reference}
          </Link>
          <p className="text-xs text-foreground-subtle">{formatDateTime(payment.created_at)}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (payment) => {
        const statusConfig = getStatusConfig(paymentStatusConfig, payment.status);
        return <StatusBadge label={statusConfig.label} tone={statusConfig.tone} title={statusConfig.meaning} />;
      },
    },
    {
      key: 'service',
      header: 'Service',
      hideBelow: 'sm',
      cell: (payment) => (
        <div>
          <Badge variant="neutral">{payment.service_type}</Badge>
          <p className="mt-0.5 font-mono text-[11px] text-foreground-subtle">{payment.service_id.slice(0, 8)}…</p>
        </div>
      ),
    },
    {
      key: 'channel',
      header: 'Channel',
      hideBelow: 'md',
      cell: (payment) => <span className="text-foreground-muted">{payment.channel ?? '—'}</span>,
    },
    {
      key: 'paid',
      header: 'Paid at',
      hideBelow: 'md',
      cell: (payment) => <span className="text-foreground-muted">{payment.paid_at ? formatDateTime(payment.paid_at) : '—'}</span>,
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      cell: (payment) => <span className="font-semibold text-foreground">{formatGhs(payment.amount_ghs)}</span>,
    },
    {
      key: 'open',
      header: '',
      align: 'right',
      cell: (payment) => (
        <Link href={`/finance/payments/${payment.id}`} className="text-sm font-medium text-primary hover:underline">
          Open
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Finance', href: '/finance' }, { label: 'Payments' }]}
        title="Payments"
        description="Authoritative payment records across consultations, lab bookings and pharmacy orders. State is owned by the backend payment service."
      />

      <DataTable<PaymentListItemDto>
        columns={columns}
        rows={items}
        getRowKey={(payment) => payment.id}
        page={query.data?.page}
        totalPages={query.data?.totalPages}
        total={query.data?.total}
        pageSize={pageSize}
        onPageChange={(next) => setParam('page', String(next))}
        loading={query.isLoading}
        error={
          query.error ? { code: query.error.code, message: query.error.message, requestId: query.error.requestId } : null
        }
        onRetry={() => void query.refetch()}
        emptyTitle="No payments"
        emptyDescription="No payments match the selected filters."
        toolbar={
          <div className="flex flex-wrap gap-3">
            <div className="w-52">
              <Select
                label="Status"
                hideLabel
                value={status}
                onChange={(event) => setParam('status', event.target.value)}
                options={STATUS_OPTIONS.map(({ value, label }) => ({ value, label }))}
              />
            </div>
            <div className="w-56">
              <Select
                label="Service type"
                hideLabel
                value={serviceType}
                onChange={(event) => setParam('service_type', event.target.value)}
                options={SERVICE_TYPE_OPTIONS}
              />
            </div>
          </div>
        }
        density="compact"
      />
    </div>
  );
}
