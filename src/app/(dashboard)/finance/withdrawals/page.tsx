'use client';

/**
 * Withdrawal review queue (§24/§25/§53) — the ONLY financial mutation the
 * dashboard performs (approve/reject), each admin-gated server-side with
 * server-enforced transitions. Bank account numbers are masked at the parse
 * boundary (backend serializes them in full — audit FS-10). Approval triggers
 * a Paystack transfer; completion arrives via webhook, so the queue refetches
 * on a 30 s interval rather than assuming HTTP 200 = money moved (§45).
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type DataTableColumn } from '@/components/data-display/DataTable';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Alert } from '@/components/ui/Alert';
import { approveWithdrawal, rejectWithdrawal } from '@/features/finance/service';
import { usePendingWithdrawals } from '@/features/finance/hooks';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { formatDateTime } from '@/lib/formatting/dates';
import { formatGhs } from '@/lib/formatting/money';
import { getStatusConfig, withdrawalStatusConfig } from '@/constants/status';
import type { WithdrawalDto } from '@/lib/api/schemas';

type ActionKind = 'approve' | 'reject';

export default function WithdrawalsPage() {
  const { adminUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const queue = usePendingWithdrawals({ refetchInterval: 30_000 });
  const items = queue.data ?? [];

  const [action, setAction] = useState<{ kind: ActionKind; withdrawal: WithdrawalDto } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async ({ kind, withdrawal, reason }: { kind: ActionKind; withdrawal: WithdrawalDto; reason: string }) => {
      const adminId = adminUser?.id ?? 'unknown-admin';
      if (kind === 'approve') {
        await approveWithdrawal(withdrawal.id, adminId);
      } else {
        await rejectWithdrawal(withdrawal.id, adminId, reason || 'Rejected from admin withdrawal review');
      }
    },
    onSuccess: (_data, variables) => {
      toast({
        variant: 'success',
        title: variables.kind === 'approve' ? 'Withdrawal approved' : 'Withdrawal rejected',
        description:
          variables.kind === 'approve'
            ? 'Transfer initiated with the payment provider. Completion arrives via provider webhook.'
            : 'Reserved funds return to the partner wallet.',
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['finance', 'withdrawals'] });
      void queryClient.invalidateQueries({ queryKey: ['finance', 'stats'] });
    },
  });

  const confirm = async (reason: string) => {
    if (!action) return;
    setActionError(null);
    try {
      await mutation.mutateAsync({ kind: action.kind, withdrawal: action.withdrawal, reason });
      setAction(null);
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : 'The withdrawal could not be processed. Refresh the queue and try again.';
      setActionError(message);
    }
  };

  const columns: Array<DataTableColumn<WithdrawalDto>> = [
    {
      key: 'partner',
      header: 'Partner',
      cell: (w) => (
        <div>
          <Link2 partner={w} />
          <p className="font-mono text-[11px] text-foreground-subtle">{w.provider_id ? `${w.provider_id.slice(0, 8)}…` : '—'}</p>
        </div>
      ),
    },
    {
      key: 'destination',
      header: 'Destination',
      hideBelow: 'sm',
      cell: (w) => (
        <div>
          <p className="text-sm font-medium text-foreground">{w.bank_name}</p>
          <p className="text-xs text-foreground-muted">
            {w.bank_account_name} · <span className="font-mono">{w.bank_account_masked}</span>
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (w) => {
        const statusConfig = getStatusConfig(withdrawalStatusConfig, w.status);
        return <StatusBadge label={statusConfig.label} tone={statusConfig.tone} title={statusConfig.meaning} />;
      },
    },
    {
      key: 'requested',
      header: 'Requested',
      hideBelow: 'md',
      cell: (w) => <span className="text-foreground-muted">{w.created_at ? formatDateTime(w.created_at) : '—'}</span>,
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      cell: (w) => <span className="font-semibold text-foreground">{formatGhs(w.amount)}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (w) => {
        const isPending = w.status.toLowerCase() === 'pending';
        if (!isPending) return <span className="text-xs text-foreground-subtle">Awaiting provider webhook</span>;
        return (
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => {
                setActionError(null);
                setAction({ kind: 'approve', withdrawal: w });
              }}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={mutation.isPending}
              onClick={() => {
                setActionError(null);
                setAction({ kind: 'reject', withdrawal: w });
              }}
            >
              Reject
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Finance', href: '/finance' }, { label: 'Withdrawals' }]}
        title="Withdrawal review"
        description="Partner payout requests. Approval initiates a provider transfer; completion is confirmed by webhook — never assumed from this action."
      />

      <Alert
        variant="info"
        title="Bank details are masked by design"
        description="Account numbers are truncated at the API boundary (audit FS-10). The backend serializes them in full today; the dashboard strips them before any component or cache sees them. Backend-side masking is requested."
      />

      <DataTable<WithdrawalDto>
        columns={columns}
        rows={items}
        getRowKey={(w) => w.id}
        loading={queue.isLoading}
        error={
          queue.error ? { code: queue.error.code, message: queue.error.message, requestId: queue.error.requestId } : null
        }
        onRetry={() => void queue.refetch()}
        emptyTitle="No pending withdrawals"
        emptyDescription="Partner payout requests awaiting review will appear here."
        density="compact"
      />

      <ConfirmDialog
        open={action !== null}
        onClose={() => setAction(null)}
        onConfirm={confirm}
        busy={mutation.isPending}
        strings={
          action?.kind === 'approve'
            ? {
                title: `Approve withdrawal of ${formatGhs(action.withdrawal.amount)}?`,
                consequence:
                  'A Paystack transfer is initiated immediately and funds are reserved from the partner wallet. Completion is confirmed by the provider webhook.',
                confirmLabel: 'Approve transfer',
                requirePhrase: 'APPROVE',
                requireReason: false,
              }
            : {
                title: 'Reject withdrawal?',
                consequence: 'Reserved funds return to the partner wallet. A written reason is recorded in the audit trail.',
                confirmLabel: 'Reject withdrawal',
                requireReason: true,
              }
        }
      />

      {actionError ? (
        <p className="text-sm text-danger" role="alert">
          {actionError}
        </p>
      ) : null}
    </div>
  );
}

function Link2({ partner }: { partner: WithdrawalDto }) {
  return (
    <p className="text-sm font-medium text-foreground">
      {partner.bank_account_name || 'Partner payout'}
    </p>
  );
}
