'use client';

/**
 * Appointment detail (§10) — the operational record for one consultation.
 *
 * Assembled from authoritative reads only: the consultation detail endpoint,
 * the SessionEvent timeline (§19), and the ConsultationRoom presence (§18).
 * Clinical content (notes, SOAP, suffering description) and Agora secrets are
 * stripped by the schemas before anything reaches this page (§30/§32). The
 * page offers no lifecycle mutations — participants own those (audit CG-1) —
 * it renders state, links to Finance/Support/Partner, and explains why.
 */

import { use, useEffect } from 'react';
import Link from 'next/link';
import {
  BadgeCheck,
  Ban,
  CalendarClock,
  CircleDot,
  LifeBuoy,
  Receipt,
  Stethoscope,
  UserRound,
  Video,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useConsultationDetail, useConsultationRoom, useSessionEvents } from '@/features/consultations/hooks';
import { recordClientAudit, AuditActions } from '@/lib/auth/auditClient';
import { formatDate, formatDateTime, formatRelativeTime, formatTime } from '@/lib/formatting/dates';
import { formatGhs } from '@/lib/formatting/money';
import { consultationStatusConfig, getStatusConfig, paymentStatusConfig } from '@/constants/status';
import type { SessionEventDto } from '@/features/consultations/service';

const EVENT_LABELS: Record<string, string> = {
  created: 'Appointment requested',
  confirmed: 'Appointment accepted by partner',
  room_created: 'Telehealth room created',
  consultation_ready: 'Marked ready',
  patient_waiting: 'Patient entered waiting room',
  provider_joined: 'Partner joined room',
  patient_joined: 'Patient joined room',
  provider_left: 'Partner left room',
  patient_left: 'Patient left room',
  session_started: 'Session started',
  session_interrupted: 'Session interrupted',
  session_resumed: 'Session resumed',
  session_ended: 'Session ended',
  documentation_started: 'Documentation started',
  consultation_completed: 'Consultation completed',
  cancelled: 'Appointment cancelled',
  no_show: 'Marked as no-show',
  rescheduled: 'Appointment rescheduled',
  payment_received: 'Payment received',
  token_generated: 'Telehealth token issued',
};

const MODE_LABELS: Record<string, string> = {
  video: 'Video',
  audio: 'Audio',
  chat: 'Chat',
  in_person: 'In person',
};

const URGENCY_TONE: Record<string, 'neutral' | 'info' | 'warning' | 'danger'> = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  critical: 'danger',
};

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-xs font-semibold uppercase tracking-wider text-foreground-subtle">{label}</dt>
      <dd className="text-right text-sm text-foreground">{children}</dd>
    </div>
  );
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '—';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function TimelineItem({ event }: { event: SessionEventDto }) {
  const label = EVENT_LABELS[event.event_type] ?? event.event_type.replaceAll('_', ' ');
  const icon = event.event_type === 'cancelled' || event.event_type === 'no_show' ? Ban : CircleDot;
  const Icon = icon;
  return (
    <li className="relative flex gap-3 pb-4">
      <span
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ${
          event.event_type === 'cancelled' || event.event_type === 'no_show'
            ? 'bg-danger-subtle text-danger ring-danger/20'
            : 'bg-primary-subtle text-primary ring-primary/20'
        }`}
      >
        <Icon className="h-3 w-3" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-foreground-subtle">
          {formatDateTime(event.created_at)} ({formatRelativeTime(event.created_at)})
          {event.actor_id ? ' · by a participant' : ' · system'}
        </p>
      </div>
    </li>
  );
}

export default function AppointmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const detail = useConsultationDetail(id);
  const data = detail.data ?? null;

  const isLive = data?.status === 'ready' || data?.status === 'in_progress';
  const room = useConsultationRoom(id, Boolean(isLive));
  const events = useSessionEvents(id);

  // §46: sensitive operational record access is audited client-side.
  useEffect(() => {
    if (data) {
      recordClientAudit({
        action: AuditActions.APPOINTMENT_VIEWED,
        category: 'ClinicalOperations',
        details: 'Administrator opened an appointment operational record',
        resource: id,
        metadata: { status: data.status },
      });
    }
  }, [data, id]);

  if (detail.error) {
    return (
      <div className="space-y-6">
        <PageHeader
          breadcrumbs={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Operations' },
            { label: 'Appointments', href: '/appointments' },
            { label: 'Detail' },
          ]}
          title="Appointment"
        />
        <Card>
          <ErrorState
            code={detail.error.code}
            message={detail.error.message}
            requestId={detail.error.requestId}
            onRetry={() => void detail.refetch()}
          />
        </Card>
      </div>
    );
  }

  if (detail.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          breadcrumbs={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Operations' },
            { label: 'Appointments', href: '/appointments' },
            { label: 'Detail' },
          ]}
          title="Appointment"
        />
        <Card>
          <div className="space-y-3">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-4 w-72" />
            <Skeleton className="h-24 w-full" />
          </div>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader
          breadcrumbs={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Operations' },
            { label: 'Appointments', href: '/appointments' },
            { label: 'Detail' },
          ]}
          title="Appointment"
        />
        <Card>
          <EmptyState
            icon={BadgeCheck}
            title="Appointment not found"
            description="This appointment does not exist or is not accessible."
          />
          <div className="flex justify-center pb-6">
            <Link href="/appointments">
              <Button variant="outline">Back to Appointments</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const statusConfig = getStatusConfig(consultationStatusConfig, data.status);
  const paymentConfig = getStatusConfig(paymentStatusConfig, data.payment_status);
  const provider = (data.provider ?? null) as { name?: string; specialty?: string } | null;
  const doctorId = typeof data.doctor_id === 'string' ? data.doctor_id : '';

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Operations' },
          { label: 'Appointments', href: '/appointments' },
          { label: data.id.slice(0, 8) },
        ]}
        title={`Appointment ${data.id.slice(0, 8)}…`}
        description={`${formatDateTime(data.date_time)} · Africa/Accra (GMT) — operational record`}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* ── Summary & schedule (§11/§12) ── */}
        <Card className="lg:col-span-2">
          <CardHeader title="Summary" description="Operational metadata only — clinical content is never rendered (§30)." />
          <dl className="divide-y divide-border/60">
            <DetailRow label="Appointment ID"><span className="font-mono text-xs">{data.id}</span></DetailRow>
            <DetailRow label="Status">
              <StatusBadge label={statusConfig.label} tone={statusConfig.tone} title={statusConfig.meaning} />
            </DetailRow>
            <DetailRow label="Type">
              <span className="inline-flex items-center gap-1.5">
                <Badge variant="neutral">{data.consultation_type}</Badge>
                <span className="text-xs text-foreground-muted">{MODE_LABELS[data.consultation_mode] ?? data.consultation_mode}</span>
              </span>
            </DetailRow>
            <DetailRow label="Urgency">
              <Badge variant={URGENCY_TONE[data.urgency_level] ?? 'neutral'}>{data.urgency_level}</Badge>
            </DetailRow>
            <DetailRow label="Scheduled for">
              {formatDate(data.date_time)} · {formatTime(data.date_time)} · Africa/Accra
            </DetailRow>
            <DetailRow label="Session window">
              {data.consultation_start_time
                ? `${formatTime(data.consultation_start_time)}${data.consultation_end_time ? ` – ${formatTime(data.consultation_end_time)}` : ' – ongoing'}`
                : 'Not started'}
            </DetailRow>
            <DetailRow label="Duration">{formatDuration(data.duration_seconds)}</DetailRow>
            <DetailRow label="Requested">{formatDateTime(data.created_at)}</DetailRow>
            {data.cancellation_reason && (
              <DetailRow label="Cancellation reason">
                <span className="whitespace-pre-line">{data.cancellation_reason}</span>
              </DetailRow>
            )}
            {data.reschedule_reason && (
              <DetailRow label="Reschedule reason">
                <span className="whitespace-pre-line">{data.reschedule_reason}</span>
              </DetailRow>
            )}
          </dl>
        </Card>

        {/* ── Readiness (§18) — from authoritative flags/states ── */}
        <Card>
          <CardHeader title="Readiness" description="Derived from backend states — never computed from client flags." />
          <ul className="space-y-2.5 text-sm">
            <li className="flex items-center justify-between gap-3">
              <span className="text-foreground-muted">Payment</span>
              <StatusBadge label={paymentConfig.label} tone={paymentConfig.tone} title={paymentConfig.meaning} />
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-foreground-muted">Appointment ready</span>
              <StatusBadge
                label={data.is_consultation_ready ? 'Ready' : 'Not ready'}
                tone={data.is_consultation_ready ? 'success' : 'neutral'}
                title={data.is_consultation_ready ? 'Backend marked the appointment ready.' : 'The appointment is not marked ready yet.'}
              />
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-foreground-muted">Room presence</span>
              {room.isLoading ? (
                <span className="text-xs text-foreground-subtle">Loading…</span>
              ) : room.data ? (
                <span className="text-xs text-foreground">
                  Partner {room.data.provider_online ? 'online' : 'offline'} · Patient{' '}
                  {room.data.patient_online ? 'online' : 'offline'}
                </span>
              ) : (
                <span className="text-xs text-foreground-subtle">No room created</span>
              )}
            </li>
            {isLive && (
              <li className="rounded-lg bg-info-subtle px-3 py-2 text-xs text-info" aria-live="polite">
                Live session — presence refreshes every 15 seconds.
              </li>
            )}
          </ul>
          {data.status === 'cancelled' && (
            <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-danger-subtle px-3 py-2 text-xs text-danger">
              <Ban className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              This appointment was cancelled. See the timeline for the recorded reason.
            </p>
          )}
          <p className="mt-3 text-[11px] leading-relaxed text-foreground-subtle">
            Administrative lifecycle actions (cancel, reschedule, no-show) are performed by participants in their
            apps — the backend does not expose admin mutations (audit CG-1).
          </p>
        </Card>

        {/* ── Participants (§13/§14) ── */}
        <Card>
          <CardHeader title="Patient" />
          <dl>
            <DetailRow label="Name">{data.patient_name ?? 'Patient'}</DetailRow>
            <DetailRow label="Patient ID"><span className="font-mono text-xs">{data.patient_id}</span></DetailRow>
          </dl>
          <Link href={`/users/${data.patient_id}`} className="mt-2 inline-flex text-xs font-semibold text-primary hover:underline">
            <UserRound className="mr-1 h-3.5 w-3.5" aria-hidden />
            Open user record
          </Link>
          <p className="mt-3 text-[11px] leading-relaxed text-foreground-subtle">
            Only operational identifiers are shown — diagnosis, history, prescriptions, and consultation content
            are excluded (§13/§30).
          </p>
        </Card>

        <Card>
          <CardHeader title="Partner" description="Doctor providing this consultation." />
          <dl>
            <DetailRow label="Name">{provider?.name ?? 'Doctor'}</DetailRow>
            {provider?.specialty && <DetailRow label="Specialty">{provider.specialty}</DetailRow>}
            <DetailRow label="Doctor ID"><span className="font-mono text-xs">{doctorId || '—'}</span></DetailRow>
          </dl>
          {doctorId && (
            <Link href={`/partners/doctor/${doctorId}`} className="mt-2 inline-flex text-xs font-semibold text-primary hover:underline">
              <Stethoscope className="mr-1 h-3.5 w-3.5" aria-hidden />
              Open partner profile
            </Link>
          )}
          <p className="mt-3 text-[11px] leading-relaxed text-foreground-subtle">
            Partner operational state is managed in Partner Management — not duplicated here (§14).
          </p>
        </Card>

        {/* ── Payment (§16/§17) ── */}
        <Card>
          <CardHeader title="Payment" description="Backend-authoritative state; the dashboard never infers payment success." />
          <dl>
            <DetailRow label="Status">
              <StatusBadge label={paymentConfig.label} tone={paymentConfig.tone} title={paymentConfig.meaning} />
            </DetailRow>
            <DetailRow label="Amount">{formatGhs(data.amount)}</DetailRow>
            <DetailRow label="Reference">
              <span className="font-mono text-xs">{data.payment_reference ?? '—'}</span>
            </DetailRow>
          </dl>
          <div className="mt-2 flex flex-col items-start gap-1.5">
            <Link href="/finance" className="inline-flex text-xs font-semibold text-primary hover:underline">
              <Receipt className="mr-1 h-3.5 w-3.5" aria-hidden />
              Open Finance
            </Link>
            <Link href="/support" className="inline-flex text-xs font-semibold text-primary hover:underline">
              <LifeBuoy className="mr-1 h-3.5 w-3.5" aria-hidden />
              Raise with Support
            </Link>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-foreground-subtle">
            Refund eligibility and settlement are computed by the backend payments module (§40).
          </p>
        </Card>

        {/* ── Telehealth (§31/§36) ── */}
        <Card className="lg:col-span-2">
          <CardHeader title="Telehealth" description="Operational session metadata. No Agora identifiers or join affordances (§32/§35)." />
          <dl>
            <DetailRow label="Room status">
              {room.data ? (
                <StatusBadge
                  label={room.data.status}
                  tone={room.data.status === 'active' ? 'success' : room.data.status === 'waiting' ? 'warning' : 'neutral'}
                  title="ConsultationRoom status from the backend."
                />
              ) : room.error ? (
                <span className="text-xs text-foreground-muted">Unavailable</span>
              ) : (
                <span className="text-xs text-foreground-subtle">No room created yet</span>
              )}
            </DetailRow>
            <DetailRow label="Mode">{MODE_LABELS[data.consultation_mode] ?? data.consultation_mode}</DetailRow>
            <DetailRow label="Presence">
              {room.data
                ? `Partner ${room.data.provider_online ? 'online' : 'offline'} · Patient ${room.data.patient_online ? 'online' : 'offline'}`
                : '—'}
            </DetailRow>
            <DetailRow label="Last activity">{room.data?.last_activity ? formatDateTime(room.data.last_activity) : '—'}</DetailRow>
          </dl>
          <Link href="/telehealth" className="mt-2 inline-flex text-xs font-semibold text-primary hover:underline">
            <Video className="mr-1 h-3.5 w-3.5" aria-hidden />
            Open Telehealth board
          </Link>
        </Card>

        {/* ── Timeline (§19) ── */}
        <Card>
          <CardHeader title="Timeline" description="Session events recorded by the backend." />
          {events.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : events.error ? (
            <p className="text-sm text-foreground-muted">Timeline unavailable ({events.error.message}).</p>
          ) : (events.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-foreground-muted">No events recorded yet.</p>
          ) : (
            <ol className="ml-1 border-l border-border/60 pl-1">
              {[...(events.data ?? [])]
                .sort((a, b) => a.created_at.localeCompare(b.created_at))
                .map((event) => (
                  <TimelineItem key={event.id} event={event} />
                ))}
            </ol>
          )}
        </Card>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-foreground-subtle">
        <CalendarClock className="h-3.5 w-3.5" aria-hidden />
        Exceptions, cancellations, reschedules, and no-shows are executed by participants; the backend owns every
        transition (see docs/admin/clinical-operations-audit.md, CG-1/CG-4). Payment questions route to Finance;
        disputes to Support.
      </p>
    </div>
  );
}
