'use client';

/**
 * Finance command center (§7–§9) — answers "what is the financial state
 * right now" from two authoritative backend sources:
 *  - GET /payments/admin/stats (KPI totals — all-time, FS-11)
 *  - GET /admin/finance/transactions (live wallet-transaction ledger feed)
 *
 * Terminology follows the backend model: revenue = successful payments,
 * refunds = successful Refund rows, net = revenue − refunds. No client-side
 * financial math beyond that backend-provided identity (§22). Refunds are
 * intentionally not navigable (no admin refund list — FS-1).
 */

import { useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type DataTableColumn } from '@/components/data-display/DataTable';
import { MetricCard } from '@/components/data-display/MetricCard';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { useFinanceTransactions, usePaymentStats } from '@/features/finance/hooks';
import { formatDateTime } from '@/lib/formatting/dates';
import { formatGhs } from '@/lib/formatting/money';
import { getStatusConfig, paymentStatusConfig } from '@/constants/status';
import type { FinanceTransactionDto } from '@/lib/api/schemas';

export default function FinancePage() {
  const [page, setPage] = useState(1);
  const stats = usePaymentStats({ refetchInterval: 60_000 });
  const feed = useFinanceTransactions(page, 50);
  const items = feed.data?.items ?? [];

  const columns: Array<DataTableColumn<FinanceTransactionDto>> = [
    {
      key: 'reference',
      header: 'Reference',
      cell: (tx) => (
        <div>
          <p className="font-mono text-xs font-semibold text-foreground">
            {tx.reference_id ? `${tx.reference_id.slice(0, 12)}…` : tx.id.slice(0, 8).toUpperCase()}
          </p>
          <p className="text-xs text-foreground-subtle">{tx.created_at ? formatDateTime(tx.created_at) : '—'}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      cell: (tx) => (
        <Badge variant={tx.type === 'credit' ? 'success' : tx.type === 'debit' ? 'danger' : 'neutral'}>{tx.type}</Badge>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      hideBelow: 'sm',
      cell: (tx) => <span className="line-clamp-1 max-w-sm text-foreground-muted">{tx.description ?? '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      hideBelow: 'md',
      cell: (tx) => {
        const statusConfig = getStatusConfig(paymentStatusConfig, tx.status ?? tx.type);
        return <StatusBadge label={statusConfig.label} tone={statusConfig.tone} title={statusConfig.meaning} />;
      },
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      cell: (tx) => (
        <span className={`font-semibold ${tx.type === 'credit' ? 'text-success' : 'text-foreground'}`}>
          {formatGhs(tx.amount)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Finance' }]}
        title="Finance"
        description="Authoritative financial state: payments, refunds and the wallet-transaction ledger. All amounts are backend-recorded — never computed here."
      />

      {stats.error ? (
        <Alert
          variant="warning"
          title="Payment statistics unavailable"
          description="The KPI totals could not be loaded. The transaction feed below remains available."
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Gross payment volume"
          value={formatGhs(stats.data?.total_revenue_ghs)}
          comparison="successful payments, all time"
          loading={stats.isLoading}
          error={stats.error ? stats.error.message : null}
          onRetry={() => void stats.refetch()}
          href="/finance/payments?status=SUCCESS"
        />
        <MetricCard
          label="Refunded"
          value={formatGhs(stats.data?.total_refunds_ghs)}
          comparison={`${stats.data?.refunded_payments_count ?? 0} payments refunded or partially refunded`}
          loading={stats.isLoading}
          href="/finance/payments?status=REFUNDED"
        />
        <MetricCard
          label="Net revenue"
          value={formatGhs(stats.data?.net_revenue_ghs)}
          comparison="volume − refunds (backend-computed)"
          loading={stats.isLoading}
        />
        <MetricCard
          label="Pending payments"
          value={String(stats.data?.pending_payments_count ?? 0)}
          comparison={`${stats.data?.failed_payments_count ?? 0} failed or abandoned, all time`}
          loading={stats.isLoading}
          href="/finance/payments?status=PENDING"
        />
      </div>

      <Alert
        variant="info"
        title="Financial scope of this dashboard"
        description="Refund records, wallet balances and settlement batches are not exposed by admin endpoints yet (audit FS-1/FS-5/FS-6) — only backend totals above. Withdrawal review and reconciliation live in their own queues. No date-range KPIs exist; totals are all-time (FS-11)."
      />

      <DataTable<FinanceTransactionDto>
        columns={columns}
        rows={items}
        getRowKey={(tx) => tx.id}
        page={feed.data?.page}
        totalPages={feed.data?.totalPages}
        total={feed.data?.total}
        pageSize={50}
        onPageChange={setPage}
        loading={feed.isLoading}
        error={
          feed.error ? { code: feed.error.code, message: feed.error.message, requestId: feed.error.requestId } : null
        }
        onRetry={() => void feed.refetch()}
        emptyTitle="No transactions"
        emptyDescription="Wallet transactions will appear here as partners earn and withdraw."
        toolbar={
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link href="/finance/payments" className="font-medium text-primary hover:underline">
              Payments center →
            </Link>
            <span className="text-foreground-subtle">·</span>
            <Link href="/finance/withdrawals" className="font-medium text-primary hover:underline">
              Withdrawal queue →
            </Link>
            <span className="text-foreground-subtle">·</span>
            <Link href="/finance/reconciliation" className="font-medium text-primary hover:underline">
              Reconciliation →
            </Link>
          </div>
        }
        density="compact"
      />
    </div>
  );
}
