'use client';

/**
 * Support & disputes (§26) — operational workflow over backend disputes.
 * Resolution requires a written resolution (audited server-side). PHI must
 * not be pasted into resolutions; reference record IDs instead (§33).
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type DataTableColumn } from '@/components/data-display/DataTable';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { fetchDisputes, resolveDispute } from '@/features/support/service';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useToast } from '@/providers/ToastProvider';
import { formatDateTime } from '@/lib/formatting/dates';
import { getStatusConfig, supportStatusConfig } from '@/constants/status';
import type { SupportDisputeDto } from '@/lib/api/schemas';

const disputesKeys = {
  list: (page: number) => ['support', 'disputes', { page }] as const,
};

export default function SupportPage() {
  const [page, setPage] = useState(1);
  const query = useApiQuery(disputesKeys.list(page), (signal) => fetchDisputes({ page, pageSize: 20, signal }));
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const resolveMutation = useMutation({
    mutationFn: ({ disputeId, resolution }: { disputeId: string; resolution: string }) =>
      resolveDispute(disputeId, resolution),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['support'] });
    },
  });

  const [resolving, setResolving] = useState<SupportDisputeDto | null>(null);
  const [resolution, setResolution] = useState('');
  const [error, setError] = useState<string | null>(null);

  const items = query.data?.disputes ?? [];

  const submitResolution = async () => {
    if (!resolving) return;
    if (resolution.trim().length < 10) {
      setError('Provide a resolution of at least 10 characters — it is recorded in the audit trail.');
      return;
    }
    try {
      await resolveMutation.mutateAsync({ disputeId: resolving.id, resolution: resolution.trim() });
      toast({ variant: 'success', title: 'Dispute resolved', description: `Reference ${resolving.id.slice(0, 8)}…` });
      setResolving(null);
      setResolution('');
      setError(null);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'The resolution could not be submitted.';
      setError(message);
    }
  };

  const columns: Array<DataTableColumn<SupportDisputeDto>> = [
    {
      key: 'subject',
      header: 'Subject',
      cell: (dispute) => (
        <div className="min-w-0">
          <p className="font-semibold text-foreground">{dispute.subject}</p>
          <p className="max-w-md truncate text-xs text-foreground-muted">{dispute.description}</p>
        </div>
      ),
    },
    {
      key: 'target',
      header: 'Target',
      hideBelow: 'sm',
      cell: (dispute) => (
        <div>
          <Badge variant="neutral">{dispute.target_type}</Badge>
          <p className="mt-0.5 font-mono text-[11px] text-foreground-subtle">{dispute.target_id.slice(0, 8)}…</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (dispute) => {
        const statusConfig = getStatusConfig(supportStatusConfig, dispute.status);
        return <StatusBadge label={statusConfig.label} tone={statusConfig.tone} title={statusConfig.meaning} />;
      },
    },
    {
      key: 'opened',
      header: 'Opened',
      hideBelow: 'md',
      cell: (dispute) => <span className="text-foreground-muted">{formatDateTime(dispute.created_at)}</span>,
    },
    {
      key: 'action',
      header: 'Action',
      align: 'right',
      cell: (dispute) => {
        const isOpen = !['resolved', 'closed'].includes(dispute.status.toLowerCase());
        return isOpen ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setResolving(dispute);
              setResolution('');
              setError(null);
            }}
          >
            Resolve
          </Button>
        ) : (
          <span className="text-xs text-foreground-subtle">
            Resolved {dispute.resolved_at ? formatDateTime(dispute.resolved_at) : ''}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Support' }, { label: 'Disputes & Tickets' }]}
        title="Support & disputes"
        description="User-reported issues requiring administrative resolution."
      />

      <DataTable<SupportDisputeDto>
        columns={columns}
        rows={items}
        getRowKey={(dispute) => dispute.id}
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
        emptyTitle="No disputes"
        emptyDescription="User-reported issues will appear here."
      />

      <Modal
        open={resolving !== null}
        onClose={() => setResolving(null)}
        title={`Resolve dispute — ${resolving?.subject ?? ''}`}
        description="The resolution is recorded in the audit trail. Reference record IDs rather than copying clinical content."
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setResolving(null)} disabled={resolveMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={submitResolution} isLoading={resolveMutation.isPending}>
              Submit resolution
            </Button>
          </>
        }
      >
        <Textarea
          label="Resolution (required, audited)"
          rows={5}
          required
          value={resolution}
          onChange={(event) => {
            setResolution(event.target.value);
            setError(null);
          }}
          placeholder="Describe the investigation and outcome…"
          error={error}
        />
      </Modal>
    </div>
  );
}
