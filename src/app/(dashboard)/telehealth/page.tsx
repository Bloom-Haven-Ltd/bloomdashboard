'use client';

/**
 * Telehealth Operations Board (§26/§31/§34/§36) — the live side of clinical
 * operations. Surfaces consultations in the three states that need eyes:
 * ready (waiting room), in_progress (session running), and interrupted
 * (session degraded). The feed re-polls every 30 s because the backend has
 * no admin realtime channel (audit CG-7 — broadcast_to_role is a stub).
 *
 * Read-only by design (§34/§35, audit CG-1): administrators observe session
 * state and presence; they never join consultations or mutate session state,
 * and no Agora identifiers (channel/token) are surfaced (audit CG-1/§32).
 */

import Link from 'next/link';
import { AlertTriangle, Clock, Radio, Video } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type DataTableColumn } from '@/components/data-display/DataTable';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useConsultations } from '@/features/consultations/hooks';
import { formatDateTime, formatRelativeTime } from '@/lib/formatting/dates';
import { consultationStatusConfig, getStatusConfig } from '@/constants/status';
import type { ConsultationFeedDto } from '@/lib/api/schemas';

/** The three live states this board exists for (§33 — backend enum values). */
const LIVE_STATUSES = new Set(['ready', 'in_progress', 'interrupted']);

const MODE_LABELS: Record<string, string> = {
  video: 'Video',
  audio: 'Audio',
  chat: 'Chat',
  in_person: 'In person',
};

export default function TelehealthPage() {
  // Poll the authoritative feed every 30 s (§53): refetch replaces the view
  // with backend state; the interval itself is never treated as truth (CG-7).
  const query = useConsultations(1, 50, 'all', { refetchInterval: 30_000 });
  const items = query.data?.items ?? [];

  const live = items.filter((item) => LIVE_STATUSES.has(item.status));

  const columns: Array<DataTableColumn<ConsultationFeedDto>> = [
    {
      key: 'session',
      header: 'Session',
      cell: (item) => (
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold text-foreground">{item.id.slice(0, 8)}…</p>
          <p className="truncate text-xs text-foreground-muted">{item.patient_name ?? 'Patient'}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'State',
      cell: (item) => {
        const config = getStatusConfig(consultationStatusConfig, item.status);
        return <StatusBadge label={config.label} tone={config.tone} title={config.meaning} />;
      },
    },
    {
      key: 'mode',
      header: 'Mode',
      hideBelow: 'sm',
      cell: (item) => <Badge variant="neutral">{MODE_LABELS[item.consultation_mode] ?? item.consultation_mode}</Badge>,
    },
    {
      key: 'scheduled',
      header: 'Scheduled',
      hideBelow: 'md',
      cell: (item) => (
        <div>
          <p className="text-foreground">{formatDateTime(item.date_time)}</p>
          <p className="text-xs text-foreground-subtle">{formatRelativeTime(item.date_time)}</p>
        </div>
      ),
    },
    {
      key: 'payment',
      header: 'Payment',
      hideBelow: 'lg',
      cell: (item) => <Badge variant="neutral">{item.payment_status.replace('_', ' ')}</Badge>,
    },
    {
      key: 'actions',
      header: 'Inspect',
      align: 'right',
      cell: (item) => (
        <Link href={`/appointments/${item.id}`} className="inline-flex">
          <Button variant="outline" size="sm">
            Open
          </Button>
        </Link>
      ),
    },
  ];

  const interruptedCount = live.filter((item) => item.status === 'interrupted').length;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Operations' }, { label: 'Telehealth' }]}
        title="Telehealth board"
        description="Live operational view of waiting rooms, active sessions, and interruptions. Session state is owned by participants and the backend; this board observes only."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-foreground-subtle">
            <Radio className="h-3.5 w-3.5" aria-hidden />
            Waiting rooms
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {live.filter((item) => item.status === 'ready').length}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-foreground-subtle">
            <Video className="h-3.5 w-3.5" aria-hidden />
            In progress
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {live.filter((item) => item.status === 'in_progress').length}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-foreground-subtle">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            Interrupted
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{interruptedCount}</p>
        </div>
      </div>

      <DataTable<ConsultationFeedDto>
        columns={columns}
        rows={live}
        getRowKey={(item) => item.id}
        loading={query.isLoading}
        error={
          query.error
            ? { code: query.error.code, message: query.error.message, requestId: query.error.requestId }
            : null
        }
        onRetry={() => void query.refetch()}
        emptyTitle="No live sessions"
        emptyDescription="No consultations are currently ready, in progress, or interrupted. This board polls every 30 seconds."
        toolbar={
          <div className="flex items-center gap-2">
            <Badge variant="neutral">
              <Clock className="h-3 w-3" aria-hidden />
              Auto-refreshing every 30 s
            </Badge>
            <Link href="/appointments" className="inline-flex">
              <Button variant="outline" size="sm">
                All appointments
              </Button>
            </Link>
          </div>
        }
      />

      <p className="text-xs text-foreground-subtle">
        The feed polls every 30 s because no admin realtime channel exists yet (audit CG-7). Administrators observe
        session state and participant presence from the detail page — joining consultations or mutating session state is
        participant-only in the backend (audit CG-1), and no Agora identifiers are exposed (§32). Presence and room
        details appear per consultation on its detail page.
      </p>
    </div>
  );
}
