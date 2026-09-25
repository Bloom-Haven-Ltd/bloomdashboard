'use client';

/**
 * Audit log center (§11/§14/§15/§16) — strictly read-only, append-only by
 * backend design. No edit or delete capability exists or will exist here.
 *
 * Backend contract (audit PS-2): GET /admin/audit-logs is paginated only —
 * no action/actor/date filters and no single-event read. Filtering below is
 * client-side over the loaded page and labeled as such; event "detail" is an
 * in-row drawer over feed data, not a separate fetch.
 */

import { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type DataTableColumn } from '@/components/data-display/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuditFeed } from '@/features/platform/hooks';
import { formatDateTime } from '@/lib/formatting/dates';
import type { AuditLogDto } from '@/lib/api/schemas';

/** Coarse severity classification from the action name (display only). */
function severityFor(action: string): 'neutral' | 'info' | 'warning' | 'danger' {
  const upper = action.toUpperCase();
  if (upper.includes('FAILED') || upper.includes('REJECT')) return 'danger';
  if (upper.includes('SUSPEND') || upper.includes('DELETE')) return 'warning';
  if (upper.includes('LOGIN') || upper.includes('VIEW')) return 'info';
  return 'neutral';
}

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [actionQuery, setActionQuery] = useState('');
  const [actorQuery, setActorQuery] = useState('');
  const [selected, setSelected] = useState<AuditLogDto | null>(null);

  const feed = useAuditFeed(page, 50);
  const logs = feed.data?.logs ?? [];

  const filtered = logs.filter((log) => {
    if (actionQuery && !log.action.toLowerCase().includes(actionQuery.toLowerCase())) return false;
    if (actorQuery && !(log.user_id ?? '').toLowerCase().includes(actorQuery.toLowerCase())) return false;
    return true;
  });

  const columns: Array<DataTableColumn<AuditLogDto>> = [
    {
      key: 'event',
      header: 'Event',
      cell: (log) => <Badge variant={severityFor(log.action)}>{log.action.replaceAll('_', ' ')}</Badge>,
    },
    {
      key: 'target',
      header: 'Target',
      hideBelow: 'sm',
      cell: (log) =>
        log.target_type ? (
          <div className="min-w-0">
            <p className="text-foreground">{log.target_type}</p>
            {log.target_id && <p className="font-mono text-[11px] text-foreground-subtle">{log.target_id.slice(0, 8)}…</p>}
          </div>
        ) : (
          <span className="text-foreground-subtle">—</span>
        ),
    },
    {
      key: 'actor',
      header: 'Actor',
      hideBelow: 'md',
      cell: (log) => (
        <span className="font-mono text-xs text-foreground-muted">{log.user_id ? `${log.user_id.slice(0, 8)}…` : 'system'}</span>
      ),
    },
    {
      key: 'source',
      header: 'Source IP',
      hideBelow: 'md',
      cell: (log) => <span className="font-mono text-xs text-foreground-muted">{log.ip_address ?? '—'}</span>,
    },
    {
      key: 'when',
      header: 'When',
      hideBelow: 'lg',
      cell: (log) => <span className="text-foreground-muted">{formatDateTime(log.created_at)}</span>,
    },
    {
      key: 'open',
      header: '',
      align: 'right',
      cell: (log) => (
        <Button variant="outline" size="sm" onClick={() => setSelected(log)}>
          Details
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Audit Logs' }]}
        title="Audit logs"
        description="Append-only record of privileged activity. Records are immutable — nothing on this page can edit or delete audit history (§15)."
      />

      <DataTable<AuditLogDto>
        columns={columns}
        rows={filtered}
        getRowKey={(log) => log.id}
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
        emptyTitle="No audit events match"
        emptyDescription="Adjust the filters below — filtering is over the loaded page because the backend feed has no query filters yet (PS-2)."
        toolbar={
          <div className="flex flex-wrap gap-3">
            <div className="w-56">
              <Input
                label="Action contains"
                hideLabel
                placeholder="e.g. SETTING, REFUND, LOGIN"
                value={actionQuery}
                onChange={(e) => setActionQuery(e.target.value)}
              />
            </div>
            <div className="w-72">
              <Input
                label="Actor ID contains"
                hideLabel
                placeholder="Paste an actor (user) ID fragment"
                value={actorQuery}
                onChange={(e) => setActorQuery(e.target.value)}
              />
            </div>
          </div>
        }
        density="compact"
      />

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? `Audit event — ${selected.action}` : 'Audit event'}
        description="Everything recorded for this event. Fields the backend does not capture (request/correlation IDs, severity, reason) are shown as absent (§12/§14)."
        size="md"
      >
        {selected ? (
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-foreground-muted">Event ID</dt>
              <dd className="font-mono text-xs">{selected.id}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-foreground-muted">Action</dt>
              <dd className="font-mono text-xs font-semibold">{selected.action}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-foreground-muted">Actor ID</dt>
              <dd className="font-mono text-xs">{selected.user_id ?? 'system'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-foreground-muted">Target</dt>
              <dd className="font-mono text-xs">
                {selected.target_type ?? '—'} {selected.target_id ? `· ${selected.target_id}` : ''}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-foreground-muted">Source IP</dt>
              <dd className="font-mono text-xs">{selected.ip_address ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-foreground-muted">Timestamp</dt>
              <dd>{formatDateTime(selected.created_at)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-foreground-muted">Request / correlation ID</dt>
              <dd className="text-xs text-foreground-subtle">not recorded by backend (PS-3)</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-foreground-muted">Severity</dt>
              <dd className="text-xs text-foreground-subtle">not recorded by backend</dd>
            </div>
            {selected.old_value ? (
              <div>
                <dt className="mb-1 text-foreground-muted">Old value (redacted view)</dt>
                <dd>
                  <pre className="max-h-40 overflow-auto rounded-lg bg-surface-muted p-3 font-mono text-[11px] whitespace-pre-wrap">
                    {JSON.stringify(selected.old_value, null, 2)}
                  </pre>
                </dd>
              </div>
            ) : null}
            {selected.new_value ? (
              <div>
                <dt className="mb-1 text-foreground-muted">New value (redacted view)</dt>
                <dd>
                  <pre className="max-h-40 overflow-auto rounded-lg bg-surface-muted p-3 font-mono text-[11px] whitespace-pre-wrap">
                    {JSON.stringify(selected.new_value, null, 2)}
                  </pre>
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </Modal>
    </div>
  );
}
