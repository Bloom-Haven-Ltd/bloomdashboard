'use client';

/**
 * Pharmacy order center (§8) — read-only operational feed. The admin feed
 * supports server-side pagination only (audit PL-12); search operates on the
 * loaded page and is labeled as such. Order detail pages are impossible until
 * the backend opens `/pharmacy-orders/{id}` to admins (audit PL-1) — rows
 * carry the full operational signal the backend permits and link to Finance,
 * the patient, and the pharmacy instead.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Search } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type DataTableColumn } from '@/components/data-display/DataTable';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { usePharmacyOrders } from '@/features/pharmacy/hooks';
import { formatDateTime, formatRelativeTime } from '@/lib/formatting/dates';
import { formatGhs } from '@/lib/formatting/money';
import { getStatusConfig, orderStatusConfig, paymentStatusConfig } from '@/constants/status';
import type { OrderFeedDto } from '@/lib/api/schemas';

const MODE_LABELS: Record<string, string> = {
  pickup: 'Pickup',
  delivery: 'Delivery',
  express_delivery: 'Express',
};

const TYPE_LABELS: Record<string, string> = {
  prescription: 'Prescription',
  otc: 'OTC',
  consultation: 'Consultation',
};

export default function OrdersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const query = usePharmacyOrders(page, 20);
  const items = useMemo(() => query.data?.items ?? [], [query.data]);

  // Client-side search over the loaded page — the admin feed accepts only
  // page/page_size (audit PL-12).
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (order) =>
        order.id.toLowerCase().includes(needle) ||
        order.patient_id.toLowerCase().includes(needle) ||
        order.pharmacy_id.toLowerCase().includes(needle) ||
        (order.payment_reference?.toLowerCase().includes(needle) ?? false) ||
        (order.prescription_id?.toLowerCase().includes(needle) ?? false)
    );
  }, [items, search]);

  const columns: Array<DataTableColumn<OrderFeedDto>> = [
    {
      key: 'order',
      header: 'Order',
      cell: (order) => (
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold text-foreground">{order.id.slice(0, 8).toUpperCase()}</p>
          <p className="truncate text-xs text-foreground-subtle">{MODE_LABELS[order.delivery_method] ?? order.delivery_method}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      hideBelow: 'sm',
      cell: (order) => <Badge variant="neutral">{TYPE_LABELS[order.order_type] ?? order.order_type}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (order) => {
        const statusConfig = getStatusConfig(orderStatusConfig, order.status);
        return <StatusBadge label={statusConfig.label} tone={statusConfig.tone} title={statusConfig.meaning} />;
      },
    },
    {
      key: 'exception',
      header: 'Flags',
      hideBelow: 'md',
      cell: (order) => {
        const flags: string[] = [];
        if (order.status === 'failed') flags.push('Retry pending');
        if (order.status === 'rejected' || order.status === 'cancelled') flags.push('Terminal');
        if (order.payment_status === 'failed') flags.push('Payment failed');
        if (order.payment_status === 'refunded') flags.push('Refunded');
        if (!flags.length) return <span className="text-foreground-subtle">—</span>;
        return (
          <div className="flex flex-col items-start gap-1">
            {flags.map((flag) => (
              <Badge key={flag} variant={flag === 'Payment failed' || flag === 'Retry pending' ? 'danger' : 'warning'}>
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
      cell: (order) => {
        const paymentConfig = getStatusConfig(paymentStatusConfig, order.payment_status);
        return <StatusBadge label={paymentConfig.label} tone={paymentConfig.tone} title={paymentConfig.meaning} />;
      },
    },
    {
      key: 'created',
      header: 'Created',
      hideBelow: 'lg',
      cell: (order) => (
        <div>
          <p className="text-foreground-muted">{formatDateTime(order.created_at)}</p>
          <p className="text-xs text-foreground-subtle">{formatRelativeTime(order.created_at)}</p>
        </div>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      cell: (order) => <span className="font-semibold text-foreground">{formatGhs(order.total_amount)}</span>,
    },
    {
      key: 'actions',
      header: 'Related',
      align: 'right',
      cell: (order) => (
        <div className="flex justify-end gap-1.5">
          <Link href={`/users/${order.patient_id}`} className="inline-flex">
            <Button variant="ghost" size="sm">
              Patient
            </Button>
          </Link>
          <Link href={`/partners/pharmacy/${order.pharmacy_id}`} className="inline-flex">
            <Button variant="ghost" size="sm">
              Pharmacy
            </Button>
          </Link>
          <Link href={`/finance`} className="inline-flex">
            <Button variant="ghost" size="sm">
              Finance
            </Button>
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Operations' }, { label: 'Pharmacy', href: '/pharmacy' }, { label: 'Orders' }]}
        title="Pharmacy orders"
        description="Fulfillment lifecycle across partner pharmacies. States are owned by pharmacies and patients; this feed observes and links (audit PL-1)."
      />

      <DataTable<OrderFeedDto>
        columns={columns}
        rows={filtered}
        getRowKey={(order) => order.id}
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
        emptyTitle="No pharmacy orders"
        emptyDescription="Orders will appear here as patients place them."
        toolbar={
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-64">
              <Input
                label="Search orders"
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
        Server-side pagination only — the admin feed accepts no filters yet (audit PL-12), so search runs on the loaded
        page. Order detail, history, and fulfillment require backend access changes (audit PL-1); lifecycle actions are
        pharmacy-app operations and are never offered here.
      </p>
    </div>
  );
}
