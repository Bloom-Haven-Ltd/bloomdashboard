'use client';

/**
 * Payment detail (§16/§17) — authoritative payment record + server-built
 * receipt. Timeline uses only backend lifecycle timestamps (paid/failed/
 * abandoned) plus receipt data; PaymentEvent webhook history has no admin
 * read endpoint (FS-2) and is not fabricated. Refunds are not navigable
 * (FS-1/FS-9) — the page states this explicitly.
 */

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { usePaymentDetail, usePaymentReceipt } from '@/features/finance/hooks';
import { recordClientAudit, AuditActions } from '@/lib/auth/auditClient';
import { formatDateTime } from '@/lib/formatting/dates';
import { formatGhs } from '@/lib/formatting/money';
import { getStatusConfig, paymentStatusConfig } from '@/constants/status';
import { useEffect } from 'react';
import type { PaymentDetailDto } from '@/lib/api/schemas';

const SERVICE_ROUTES: Record<string, string> = {
  CONSULTATION: '/appointments',
  LAB_BOOKING: '/lab-bookings',
  PHARMACY_ORDER: '/orders',
};

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="text-sm text-foreground-muted">{label}</dt>
      <dd className="text-right text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

export default function PaymentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const detail = usePaymentDetail(id);
  const receipt = usePaymentReceipt(id);
  const payment = detail.data as PaymentDetailDto | null | undefined;

  useEffect(() => {
    if (payment) {
      recordClientAudit({
        action: AuditActions.PAYMENT_VIEWED,
        category: 'Finance',
        resource: payment.id,
        details: `Viewed payment ${payment.reference} (${payment.status})`,
      });
    }
  }, [payment]);

  if (detail.isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader breadcrumbs={[{ label: 'Finance', href: '/finance' }, { label: 'Payments', href: '/finance/payments' }, { label: '…' }]} title="Payment" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (detail.error) {
    return (
      <EmptyState
        title="Payment could not be loaded"
        description={detail.error.message}
        action={<Button variant="outline" onClick={() => void detail.refetch()}>Retry</Button>}
      />
    );
  }

  if (!payment) {
    return (
      <EmptyState
        title="Payment not found"
        description="It may have been removed, or the link is incorrect."
        action={<Button variant="outline" onClick={() => history.back()}>Go back</Button>}
      />
    );
  }

  const statusConfig = getStatusConfig(paymentStatusConfig, payment.status);

  const lifecycle = [
    { label: 'Payment initiated', at: payment.created_at as string | null | undefined, done: true },
    { label: 'Paid', at: payment.paid_at, done: true },
    { label: 'Failed', at: (payment as Record<string, unknown>).failed_at as string | undefined, done: true },
    { label: 'Abandoned', at: (payment as Record<string, unknown>).abandoned_at as string | undefined, done: true },
  ].filter((step) => step.at);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Finance', href: '/finance' }, { label: 'Payments', href: '/finance/payments' }, { label: payment.reference }]}
        title={`Payment ${payment.reference}`}
        description="Backend-authoritative payment record. Provider references are displayed as recorded."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Summary" description="Core financial record — amounts exactly as stored." />
          <dl className="mt-2 divide-y divide-border">
            <SummaryRow label="Status" value={<StatusBadge label={statusConfig.label} tone={statusConfig.tone} title={statusConfig.meaning} />} />
            <SummaryRow label="Amount" value={formatGhs(payment.amount_ghs)} />
            <SummaryRow label="Currency" value={payment.currency} />
            <SummaryRow label="Channel" value={payment.channel ?? '—'} />
            <SummaryRow label="Service type" value={<Badge variant="neutral">{payment.service_type}</Badge>} />
            <SummaryRow
              label="Linked record"
              value={
                SERVICE_ROUTES[payment.service_type] ? (
                  <Link className="font-medium text-primary hover:underline" href={SERVICE_ROUTES[payment.service_type]}>
                    Open {payment.service_type.toLowerCase().replace(/_/g, ' ')}
                  </Link>
                ) : (
                  <span className="font-mono text-xs">{payment.service_id.slice(0, 8)}…</span>
                )
              }
            />
            <SummaryRow label="Created" value={formatDateTime(payment.created_at)} />
            <SummaryRow label="Paid at" value={payment.paid_at ? formatDateTime(payment.paid_at) : '—'} />
          </dl>
        </Card>

        <Card>
          <CardHeader title="Receipt" description="Server-built receipt — authoritative names and amounts." />
          {receipt.isLoading ? (
            <Skeleton className="mt-4 h-48 w-full" />
          ) : receipt.data ? (
            <dl className="mt-2 divide-y divide-border">
              <SummaryRow label="Receipt number" value={<span className="font-mono text-xs">{receipt.data.receipt_number}</span>} />
              <SummaryRow label="Patient" value={receipt.data.patient_name} />
              <SummaryRow label="Provider" value={receipt.data.provider_name} />
              <SummaryRow label="Payment method" value={receipt.data.payment_method} />
              <SummaryRow label="Receipt status" value={receipt.data.payment_status} />
            </dl>
          ) : (
            <p className="mt-3 text-sm text-foreground-muted">Receipt unavailable.</p>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="Lifecycle" description="Backend-recorded lifecycle timestamps. Webhook event history is not exposed by an admin endpoint (FS-2)." />
        {lifecycle.length ? (
          <ol className="mt-3 space-y-3">
            {lifecycle.map((step) => (
              <li key={step.label} className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
                <div>
                  <p className="text-sm font-medium text-foreground">{step.label}</p>
                  <p className="text-xs text-foreground-subtle">{formatDateTime(step.at as string)}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-foreground-muted">No lifecycle timestamps recorded yet.</p>
        )}
      </Card>

      <Alert
        variant="info"
        title="Refunds are not actionable here"
        description="Refund records have no admin read endpoint, and the backend admin refund route is currently broken (audit FS-1/FS-9). Refund state is visible in the KPI totals and payment status only. This is deliberate until the backend refund surfaces are fixed and re-audited."
      />
    </div>
  );
}
