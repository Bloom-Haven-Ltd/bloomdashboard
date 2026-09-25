'use client';

/**
 * Reconciliation center (§27–§30) — the dashboard TRIGGERS runs and DISPLAYS
 * backend-computed reports; every match/mismatch determination is made
 * server-side (§30). Two run types exist:
 *  - POST /wallets/reconcile — wallet↔ledger balance drift (persisted,
 *    returns discrepancies with wallet vs ledger amounts)
 *  - POST /payments/admin/reconcile — recent payments vs Paystack live
 *    (inline report, not persisted — FS-12; the result disappears on reload
 *    and this page says so)
 * Results are never recomputed client-side; variance amounts are displayed
 * exactly as the backend reports them.
 */

import { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { EmptyState } from '@/components/ui/EmptyState';
import { MetricCard } from '@/components/data-display/MetricCard';
import { useWalletReconciliation } from '@/features/finance/hooks';
import { runPaymentsReconciliation, type PaymentsReconciliationResult } from '@/features/finance/paymentsReconciliation';
import { formatGhs } from '@/lib/formatting/money';
import { formatDateTime } from '@/lib/formatting/dates';

export default function ReconciliationPage() {
  const walletRun = useWalletReconciliation();
  const [payRun, setPayRun] = useState<PaymentsReconciliationResult | null>(null);
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const startPaymentRecon = async () => {
    setPayBusy(true);
    setPayError(null);
    try {
      setPayRun(await runPaymentsReconciliation());
    } catch (cause) {
      setPayError(cause instanceof Error ? cause.message : 'The reconciliation run failed.');
    } finally {
      setPayBusy(false);
    }
  };

  const wallet = walletRun.data ?? null;
  const walletClean = wallet ? wallet.mismatched_count === 0 : null;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Finance', href: '/finance' }, { label: 'Reconciliation' }]}
        title="Reconciliation"
        description="Backend reconciliation engines compare internal records against provider and ledger data. The dashboard triggers runs and displays results — it never computes matches."
      />

      <Alert
        variant="info"
        title="Run results are not stored for later reads"
        description="The payments↔Paystack report is returned inline and disappears on reload (audit FS-12); the wallet↔ledger run is recorded in the backend reconciliation audit. History views are a backend dependency."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Wallet ↔ ledger"
            description="Compares every partner wallet balance against the authoritative ledger sum (0.01 tolerance). Recorded server-side."
            action={
              <Button onClick={() => void walletRun.run().catch(() => undefined)} isLoading={walletRun.isPending}>
                Run check
              </Button>
            }
          />
          {wallet ? (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <MetricCard label="Wallets checked" value={String(wallet.total_checked)} />
                <MetricCard label="Matched" value={String(wallet.matched_count)} />
                <MetricCard
                  label="Mismatches"
                  value={String(wallet.mismatched_count)}
                  error={wallet.mismatched_count > 0 ? 'Discrepancies detected' : null}
                />
              </div>
              <p className="flex items-center gap-2 text-sm text-foreground-muted">
                Run status{' '}
                <StatusBadge
                  label={walletClean ? 'Clean' : 'Discrepancies'}
                  tone={walletClean ? 'success' : 'danger'}
                  title={wallet.status}
                />{' '}
                · {formatDateTime(wallet.timestamp)}
              </p>
              {wallet.discrepancies?.length ? (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-foreground-muted">
                      <tr>
                        <th className="px-3 py-2">Partner</th>
                        <th className="px-3 py-2 text-right">Wallet funds</th>
                        <th className="px-3 py-2 text-right">Ledger</th>
                        <th className="px-3 py-2 text-right">Difference</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {wallet.discrepancies.map((d) => (
                        <tr key={d.provider_id}>
                          <td className="px-3 py-2 font-mono text-xs">{d.provider_id.slice(0, 8)}…</td>
                          <td className="px-3 py-2 text-right">{formatGhs(d.wallet_total_funds)}</td>
                          <td className="px-3 py-2 text-right">{formatGhs(d.ledger_balance)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-danger">{formatGhs(d.difference)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-success">All wallet balances reconcile with the ledger.</p>
              )}
            </div>
          ) : (
            <EmptyState
              title="No run in this session"
              description="Trigger a wallet↔ledger check to compare balances against the authoritative ledger."
            />
          )}
        </Card>

        <Card>
          <CardHeader
            title="Payments ↔ Paystack"
            description="Compares the most recent payments against live Paystack transactions (up to 200 per run). Inline report — not persisted."
            action={
              <Button onClick={() => void startPaymentRecon()} isLoading={payBusy}>
                Run check
              </Button>
            }
          />
          {payError ? (
            <Alert variant="danger" title="Run failed" description={payError} />
          ) : payRun ? (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <MetricCard label="Transactions checked" value={String(payRun.totalChecked)} />
                <MetricCard label="Matched" value={String(payRun.matchedCount)} />
                <MetricCard
                  label="Mismatches"
                  value={String(payRun.mismatchCount)}
                  error={payRun.mismatchCount > 0 ? 'Investigate below' : null}
                />
              </div>
              {payRun.items.length ? (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-foreground-muted">
                      <tr>
                        <th className="px-3 py-2">Reference</th>
                        <th className="px-3 py-2">Result</th>
                        <th className="px-3 py-2">Bloom</th>
                        <th className="px-3 py-2">Gateway</th>
                        <th className="px-3 py-2">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {payRun.items.map((item) => (
                        <tr key={item.reference}>
                          <td className="px-3 py-2 font-mono text-xs">{item.reference}</td>
                          <td className="px-3 py-2">
                            <Badge variant={/match/i.test(item.result) ? 'success' : 'danger'}>{item.result}</Badge>
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {item.bloomStatus ?? '—'} · {item.bloomAmountGhs != null ? formatGhs(item.bloomAmountGhs) : '—'}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {item.gatewayStatus ?? 'missing'} ·{' '}
                            {item.gatewayAmountGhs != null ? formatGhs(item.gatewayAmountGhs) : '—'}
                          </td>
                          <td className="max-w-[16rem] truncate px-3 py-2 text-xs text-foreground-muted" title={item.details ?? undefined}>
                            {item.details ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-success">All checked transactions agree with the gateway.</p>
              )}
              <p className="text-xs text-foreground-subtle">Run generated {formatDateTime(payRun.generatedAt)}.</p>
            </div>
          ) : (
            <EmptyState
              title="No run in this session"
              description="Trigger a payments↔Paystack check to compare recent payments against the live gateway."
            />
          )}
        </Card>
      </div>
    </div>
  );
}
