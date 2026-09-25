'use client';

/**
 * Verification review page (§6.8–§6.12) — the single decision surface.
 *
 * Data is assembled from authoritative sources only: the verification queue
 * (GET /admin/verifications/pending), the partner profile
 * (GET /doctors|labs|pharmacies/{id}), and the audit trail. The decision
 * itself is a backend-authorized, server-audited PATCH — this page never
 * sets verification state locally (§22, §70).
 *
 * Documents are metadata-only: the backend has no signed-URL endpoint yet
 * (audit BG-2), so no storage URL is ever fetched or rendered (§16–§17).
 */

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  CheckCircle2,
  CircleSlash,
  FlaskConical,
  Info,
  Stethoscope,
  XCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/Badge';
import { Textarea } from '@/components/ui/Textarea';
import { Skeleton } from '@/components/ui/Skeleton';
import { usePendingVerifications, useVerificationDecision } from '@/features/verification/hooks';
import { usePartnerDetail } from '@/features/partners/hooks';
import { recordClientAudit, AuditActions } from '@/lib/auth/auditClient';
import { formatDateTime, formatRelativeTime } from '@/lib/formatting/dates';
import { isPermission } from '@/lib/permissions';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { verificationStatusConfig } from '@/constants/status';
import type { PendingVerificationDto } from '@/lib/api/schemas';

const ROLE_META: Record<string, { label: string; icon: typeof Stethoscope; type: 'doctor' | 'lab' | 'pharmacy' }> = {
  doctor: { label: 'Doctor', icon: Stethoscope, type: 'doctor' },
  lab: { label: 'Laboratory', icon: FlaskConical, type: 'lab' },
  pharmacy: { label: 'Pharmacy', icon: Building2, type: 'pharmacy' },
};

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-xs font-semibold uppercase tracking-wider text-foreground-subtle">{label}</dt>
      <dd className="text-right text-sm text-foreground">{children}</dd>
    </div>
  );
}

/** Checklist row for the pre-decision summary (§23). */
function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  const Icon = ok ? CheckCircle2 : CircleSlash;
  return (
    <li className="flex items-center gap-2 text-sm">
      <Icon className={`h-4 w-4 shrink-0 ${ok ? 'text-success' : 'text-foreground-subtle'}`} aria-hidden />
      <span className={ok ? 'text-foreground' : 'text-foreground-muted'}>{label}</span>
      <span className="sr-only">{ok ? 'Present' : 'Missing'}</span>
    </li>
  );
}

function DocumentsMetadata({ documents }: { documents: Record<string, unknown> }) {
  const keys = Object.keys(documents);
  if (keys.length === 0) return null;
  return (
    <div className="mt-3 rounded-lg bg-surface-muted p-3">
      <p className="text-xs font-semibold text-foreground">Submitted documents (metadata only)</p>
      <ul className="mt-1.5 space-y-1">
        {keys.map((key) => {
          const value = documents[key];
          return (
            <li key={key} className="text-xs text-foreground-muted">
              <span className="font-medium capitalize">{key.replaceAll('_', ' ')}</span>
              {value !== null && typeof value === 'object'
                ? ` — ${Object.keys(value as Record<string, unknown>).length} field(s)`
                : ''}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-foreground-subtle">
        <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
        Files are not viewable from the dashboard yet — the backend does not issue short-lived signed
        document URLs (audit BG-2). No storage URLs are shown, fetched, or logged here.
      </p>
    </div>
  );
}

export default function VerificationReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { can } = useAuth();
  const { toast } = useToast();

  const queue = usePendingVerifications();
  const entry: PendingVerificationDto | undefined = useMemo(
    () => queue.data?.find((item) => item.id === id),
    [queue.data, id]
  );
  const roleMeta = entry ? ROLE_META[entry.role] : undefined;

  // Profile detail is fetched only once the queue entry fixes the type —
  // one authoritative source per fact, no guessing by id shape.
  const profile = usePartnerDetail(roleMeta?.type ?? 'doctor', id, { enabled: Boolean(roleMeta) });

  const decisionMutation = useVerificationDecision();

  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // §14/§46: reviewing a specific submission is a sensitive access event.
  useEffect(() => {
    if (entry) {
      recordClientAudit({
        action: AuditActions.VIEW_VERIFICATION,
        category: 'Verification',
        details: `Administrator opened the review for a pending ${entry.role} submission`,
        resource: entry.id,
        metadata: { role: entry.role, user_id: entry.user_id },
      });
    }
  }, [entry]);

  const canReview = isPermission('verification.review') && can('verification.review');
  const canApprove = canReview && isPermission('verification.approve') && can('verification.approve');
  const canReject = canReview && isPermission('verification.reject') && can('verification.reject');

  const checklist = useMemo(() => {
    if (!entry) return [];
    const hasDocuments =
      entry.documents != null && typeof entry.documents === 'object' && Object.keys(entry.documents).length > 0;
    const profileData = profile.data;
    return [
      { label: 'License number submitted', ok: Boolean(entry.license_number?.trim()) },
      { label: 'Documents submitted', ok: hasDocuments },
      {
        label: 'Professional profile complete',
        ok: profileData
          ? profileData.kind === 'doctor'
            ? profileData.specialty.trim().length > 0
            : profileData.name.trim().length > 0
          : false,
      },
    ];
  }, [entry, profile.data]);

  const submitDecision = async (approve: boolean) => {
    if (!entry) return;
    if (!approve && reason.trim().length < 4) {
      setReasonError('A rejection reason is required and recorded in the audit trail.');
      return;
    }
    setActionError(null);
    try {
      await decisionMutation.mutateAsync({
        role: ROLE_META[entry.role].type,
        profileId: entry.id,
        approve,
        rejectionReason: approve ? undefined : reason.trim(),
      });
      toast({
        variant: 'success',
        title: approve ? 'Verification approved' : 'Verification rejected',
        description: `${entry.display_name} — decision recorded by the backend and queued for refresh.`,
      });
      setDecision(null);
      setReason('');
      setReasonError(null);
    } catch (cause) {
      // §70: never mutate local state on failure — surface the backend error
      // and keep the queue authoritative via the settle-time invalidation.
      const message = cause instanceof Error ? cause.message : 'The decision could not be submitted.';
      setActionError(message);
    }
  };

  // ── Resolved states ──────────────────────────────────────────────────────

  if (queue.error) {
    return (
      <div className="space-y-6">
        <PageHeader
          breadcrumbs={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Trust & Safety' },
            { label: 'Verification', href: '/verification' },
            { label: 'Review' },
          ]}
          title="Verification review"
        />
        <Card>
          <ErrorState
            code={queue.error.code}
            message={queue.error.message}
            requestId={queue.error.requestId}
            onRetry={() => void queue.refetch()}
          />
        </Card>
      </div>
    );
  }

  if (queue.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          breadcrumbs={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Trust & Safety' },
            { label: 'Verification', href: '/verification' },
            { label: 'Review' },
          ]}
          title="Verification review"
        />
        <Card>
          <div className="space-y-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
            <Skeleton className="h-24 w-full" />
          </div>
        </Card>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="space-y-6">
        <PageHeader
          breadcrumbs={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Trust & Safety' },
            { label: 'Verification', href: '/verification' },
            { label: 'Review' },
          ]}
          title="Verification review"
        />
        <Card>
          <EmptyState
            icon={BadgeCheck}
            title="This submission is no longer pending"
            description="It may already have been decided by another administrator. The queue shows current backend state."
          />
          <div className="flex justify-center pb-6">
            <Link href="/verification">
              <Button variant="outline">Back to Verification Center</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  // ── Active review ────────────────────────────────────────────────────────

  const pendingStatus = verificationStatusConfig.pending;
  const pendingLabel = `${ROLE_META[entry.role]?.label ?? entry.role} — ${pendingStatus.label}`;
  const statusTone = pendingStatus.tone;

  const applicant = profile.data;
  const documents =
    entry.documents && typeof entry.documents === 'object' && !Array.isArray(entry.documents)
      ? (entry.documents as Record<string, unknown>)
      : null;

  const isBusy = decisionMutation.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Trust & Safety' },
          { label: 'Verification', href: '/verification' },
          { label: 'Review' },
        ]}
        title={entry.display_name}
        description={`Pending ${ROLE_META[entry.role]?.label ?? entry.role} verification · submitted ${formatDateTime(
          entry.created_at
        )} (${formatRelativeTime(entry.created_at)})`}
      />

      {isBusy && (
        <Alert
          variant="info"
          title="Submitting decision"
          description="The backend is processing the decision. Controls are disabled until it completes to prevent duplicate submissions."
        />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* ── Applicant & verification state ── */}
        <Card className="lg:col-span-2">
          <CardHeader title="Applicant summary" description="Only fields returned by the backend are shown (§13/§51)." />
          <dl className="divide-y divide-border/60">
            <DetailRow label="Applicant">
              <span className="font-semibold">{entry.display_name}</span>
            </DetailRow>
            <DetailRow label="Partner type">
              <Badge variant="primary">{ROLE_META[entry.role]?.label ?? entry.role}</Badge>
            </DetailRow>
            <DetailRow label="Status">
              <StatusBadge label={pendingLabel} tone={statusTone} title={pendingStatus.meaning} />
            </DetailRow>
            <DetailRow label="Profile ID">
              <span className="font-mono text-xs">{entry.id}</span>
            </DetailRow>
            <DetailRow label="User ID">
              <span className="font-mono text-xs">{entry.user_id}</span>
            </DetailRow>
            <DetailRow label="Email">{entry.email}</DetailRow>
            <DetailRow label="License number">{entry.license_number ?? '—'}</DetailRow>
            <DetailRow label="Submitted">{formatDateTime(entry.created_at)}</DetailRow>
          </dl>
        </Card>

        {/* ── Decision panel ── */}
        <Card>
          <CardHeader
            title="Decision"
            description="Authorized and audited by the backend (VERIFY_PROVIDER)."
          />

          <ul className="mb-4 space-y-2" aria-label="Pre-decision checklist">
            {checklist.map((row) => (
              <CheckRow key={row.label} ok={row.ok} label={row.label} />
            ))}
          </ul>

          {actionError && (
            <Alert
              variant="danger"
              title="Decision failed"
              description={`${actionError} The queue has been refreshed with backend state.`}
              className="mb-4"
            />
          )}

          <div className="space-y-2">
            <Button className="w-full" onClick={() => setDecision('approve')} disabled={!canApprove || isBusy}>
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              Approve verification
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setDecision('reject')}
              disabled={!canReject || isBusy}
            >
              <XCircle className="h-4 w-4" aria-hidden />
              Reject submission
            </Button>
          </div>

          {!canReview && (
            <p className="mt-3 text-xs text-foreground-subtle">
              Your role does not grant review permissions. Decisions are disabled.
            </p>
          )}

          <p className="mt-4 text-[11px] leading-relaxed text-foreground-subtle">
            Reviewer assignment, correction requests, and document expiry are not supported by the backend yet —
            see docs/admin/trust-safety-audit.md (BG-10, BG-11, BG-3).
          </p>

          {applicant && (
            <Link href={`/partners/${ROLE_META[entry.role].type}/${entry.id}`} className="mt-3 inline-flex text-xs font-semibold text-primary hover:underline">
              Open full partner profile
            </Link>
          )}
        </Card>

        {/* ── Professional information ── */}
        <Card className="lg:col-span-2">
          <CardHeader title="Professional information" description="From the partner profile endpoint (§15)." />
          {profile.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : profile.error ? (
            <p className="text-sm text-foreground-muted">
              Professional profile could not be loaded ({profile.error.message}). Review continues with the
              submission data above.
            </p>
          ) : applicant ? (
            <dl className="divide-y divide-border/60">
              {applicant.kind === 'doctor' && (
                <>
                  <DetailRow label="Specialty">{applicant.specialty}</DetailRow>
                  <DetailRow label="Experience">{applicant.experience_years} years</DetailRow>
                  <DetailRow label="Consultation fee">{String(applicant.consultation_fee)}</DetailRow>
                  <DetailRow label="License number">{applicant.license_number ?? '—'}</DetailRow>
                  <DetailRow label="Education entries">{String(applicant.education?.length ?? 0)}</DetailRow>
                  <DetailRow label="Certifications">{String(applicant.certifications?.length ?? 0)}</DetailRow>
                </>
              )}
              {applicant.kind === 'lab' && (
                <>
                  <DetailRow label="Laboratory name">{applicant.name}</DetailRow>
                  <DetailRow label="Rating">
                    {applicant.rating != null ? `${applicant.rating.toFixed(1)} (${applicant.total_reviews ?? 0} reviews)` : '—'}
                  </DetailRow>
                </>
              )}
              {applicant.kind === 'pharmacy' && (
                <>
                  <DetailRow label="Pharmacy name">{applicant.name}</DetailRow>
                  <DetailRow label="Pharmacy type">{applicant.pharmacy_type}</DetailRow>
                  <DetailRow label="License number">{applicant.license_number ?? '—'}</DetailRow>
                  <DetailRow label="Address">{applicant.address ?? '—'}</DetailRow>
                  <DetailRow label="Ghana Post GPS">{applicant.ghana_post_gps ?? '—'}</DetailRow>
                </>
              )}
            </dl>
          ) : (
            <p className="text-sm text-foreground-muted">Professional profile is loading…</p>
          )}
        </Card>

        {/* ── Documents (metadata only) ── */}
        <Card>
          <CardHeader title="Documents" description="Metadata only until signed-URL access exists (§16–§17)." />
          {documents && Object.keys(documents).length > 0 ? (
            <DocumentsMetadata documents={documents} />
          ) : (
            <p className="text-sm text-foreground-muted">
              No document metadata was submitted with this application
              {entry.role === 'doctor' ? ' — doctor submissions carry no documents in the current backend model.' : '.'}
            </p>
          )}
        </Card>
      </div>

      {/* ── Approve confirmation (§69) ── */}
      <Modal
        open={decision === 'approve'}
        onClose={() => (isBusy ? undefined : setDecision(null))}
        title={`Approve verification — ${entry.display_name}`}
        description="Approval grants this partner platform access for their role, starts their subscription trial, and is recorded in the audit trail."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDecision(null)} disabled={isBusy}>
              Cancel
            </Button>
            <Button onClick={() => void submitDecision(true)} isLoading={isBusy}>
              Approve partner
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-foreground">
            <strong>{entry.display_name}</strong> ({ROLE_META[entry.role]?.label ?? entry.role}) · license{' '}
            <span className="font-mono text-xs">{entry.license_number ?? '—'}</span>
          </p>
          <ul className="space-y-1.5 text-sm text-foreground-muted">
            <li>✓ Required documents reviewed (metadata above)</li>
            <li>✓ Professional information checked</li>
            <li>✓ No unresolved blocking issue recorded</li>
          </ul>
          <p className="text-xs text-foreground-subtle">
            The backend performs the state change, mirrors verification onto the user account, and writes the audit
            entry. This dialog cannot approve on its own.
          </p>
        </div>
      </Modal>

      {/* ── Reject confirmation (§24/§25) ── */}
      <Modal
        open={decision === 'reject'}
        onClose={() => (isBusy ? undefined : setDecision(null))}
        title={`Reject submission — ${entry.display_name}`}
        description="The partner will be able to see this decision. The reason is required and recorded in the audit trail."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDecision(null)} disabled={isBusy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void submitDecision(false)} isLoading={isBusy}>
              Reject submission
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-foreground-muted">
            Affected applicant: <strong className="text-foreground">{entry.display_name}</strong> · ID{' '}
            <span className="font-mono text-xs">{entry.id}</span>
          </p>
          <p className="flex items-start gap-1.5 text-xs text-foreground-subtle">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            Rejection is recorded against the partner account. Structured rejection reason codes do not exist in the
            backend yet (audit BG-11) — a free-text reason is used and audited.
          </p>
          <Textarea
            label="Rejection reason (required, audited)"
            rows={4}
            required
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setReasonError(null);
            }}
            placeholder="Explain what the partner must correct or why the submission is rejected…"
            error={reasonError}
          />
        </div>
      </Modal>
    </div>
  );
}
