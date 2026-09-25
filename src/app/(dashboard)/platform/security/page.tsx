'use client';

/**
 * Security events (§17/§18) — there is no backend security-event model
 * (audit PS-5), so this page is an explicitly labeled LENS over the audit
 * feed: it filters security-relevant actions and classifies severity for
 * display only. Severity here is never presented as backend truth, cannot be
 * changed, and no incident/assignment workflow is faked (§19 would need a
 * backend model). Feed polls every 30 s.
 */

import { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type DataTableColumn } from '@/components/data-display/DataTable';
import { StatusBadge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useAuditFeed } from '@/features/platform/hooks';
import { toSecurityEvents, classifySecuritySeverity, type SecurityEvent } from '@/features/platform/service';
import { formatDateTime } from '@/lib/formatting/dates';
import type { AuditLogDto } from '@/lib/api/schemas';

const SEVERITY_TONE: Record<SecurityEvent['severity'], 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  critical: 'danger',
  high: 'danger',
  medium: 'warning',
  low: 'info',
  info: 'neutral',
};

const SEVERITY_FILTERS = [
  { value: 'all', label: 'All severities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
] as const;

export default function SecurityEventsPage() {
  const [page, setPage] = useState(1);
  const [severity, setSeverity] = useState<string>('all');
  const [selected, setSelected] = useState<AuditLogDto | null>(null);

  const feed = useAuditFeed(page, 50);
  const events = toSecurityEvents(feed.data?.logs ?? []);
  const filtered = severity === 'all' ? events : events.filter((e) => e.severity === severity);

  const columns: Array<DataTableColumn<SecurityEvent>> = [
    {
      key: 'severity',
      header: 'Severity',
      cell: (event) => (
        <StatusBadge
          label={event.severity.toUpperCase()}
          tone={SEVERITY_TONE[event.severity]}
          title="Display classification from the action name — not a backend field"
        />
      ),
    },
    {
      key: 'action',
      header: 'Action',
      cell: (event) => <span className="font-mono text-xs font-semibold text-foreground">{event.log.action}</span>,
    },
    {
      key: 'target',
      header: 'Target',
      hideBelow: 'sm',
      cell: (event) =>
        event.log.target_type ? (
          <div className="min-w-0">
            <p className="text-foreground">{event.log.target_type}</p>
            {event.log.target_id && (
              <p className="font-mono text-[11px] text-foreground-subtle">{event.log.target_id.slice(0, 8)}…</p>
            )}
          </div>
        ) : (
          <span className="text-foreground-subtle">—</span>
        ),
    },
    {
      key: 'ip',
      header: 'Source IP',
      hideBelow: 'md',
      cell: (event) => <span className="font-mono text-xs text-foreground-muted">{event.log.ip_address ?? '—'}</span>,
    },
    {
      key: 'when',
      header: 'When',
      hideBelow: 'md',
      cell: (event) => <span className="text-foreground-muted">{formatDateTime(event.log.created_at)}</span>,
    },
    {
      key: 'open',
      header: '',
      align: 'right',
      cell: (event) => (
        <Button variant="outline" size="sm" onClick={() => setSelected(event.log)}>
          Details
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Platform', href: '/platform' }, { label: 'Security' }]}
        title="Security events"
        description="Security-relevant audit activity. This view filters and classifies the audit feed client-side — no dedicated security-event model exists in the backend yet."
      />

      <Alert
        variant="warning"
        title="Display-only severity"
        description="Severity is classified from the action name for triage convenience. The backend does not yet persist security events or severity (platform-audit.md PS-5); do not treat this view as an authoritative security feed."
      />

      <DataTable<SecurityEvent>
        columns={columns}
        rows={filtered}
        getRowKey={(event) => event.log.id}
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
        emptyTitle="No security-relevant events on this page"
        emptyDescription="Audit actions such as FAILED_LOGIN, SUSPEND or DENIED will appear here."
        toolbar={
          <label className="flex items-center gap-2 text-sm text-foreground-muted">
            Severity
            <select
              className="rounded-lg border border-border bg-card px-2 py-1.5 text-sm text-foreground"
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              aria-label="Filter by display severity"
            >
              {SEVERITY_FILTERS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        }
        density="compact"
      />

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? `Event — ${selected.action}` : 'Event'}
        size="md"
      >
        {selected ? (
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-foreground-muted">Action</dt>
              <dd className="font-mono text-xs font-semibold">{selected.action}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-foreground-muted">Display severity</dt>
              <dd>{classifySecuritySeverity(selected.action).toUpperCase()}</dd>
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
          </dl>
        ) : null}
      </Modal>
    </div>
  );
}
