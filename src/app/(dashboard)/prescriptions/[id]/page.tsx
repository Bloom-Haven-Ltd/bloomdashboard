'use client';

/**
 * Prescription detail (§13) — operational record for one prescription.
 *
 * The clinical/operational separation (§13/§30) is enforced in three layers:
 * 1. The list schema drops clinical fields entirely (schemas.ts).
 * 2. This detail parse carries `diagnosis` / medication `instructions`, but
 * 3. they render ONLY behind the `prescriptions.clinical` permission check,
 *    and access is audited (PRESCRIPTION_VIEWED, §40).
 *
 * No mutations: status changes belong to the prescriber and the assigned
 * pharmacy in their own apps.
 */

import { use, useEffect } from 'react';
import Link from 'next/link';
import { CalendarClock, Lock, Receipt, Stethoscope, UserRound } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { usePrescriptionDetail } from '@/features/pharmacy/hooks';
import { recordClientAudit, AuditActions } from '@/lib/auth/auditClient';
import { formatDateTime, formatRelativeTime } from '@/lib/formatting/dates';
import { getStatusConfig, prescriptionStatusConfig } from '@/constants/status';
import { usePermissions } from '@/providers/AuthProvider';

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-xs font-semibold uppercase tracking-wider text-foreground-subtle">{label}</dt>
      <dd className="text-right text-sm text-foreground">{children}</dd>
    </div>
  );
}

export default function PrescriptionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { can } = usePermissions();
  const canSeeClinical = can('prescriptions.clinical');

  const detail = usePrescriptionDetail(id);
  const data = detail.data ?? null;

  // §40: prescription record access is audited client-side on every open.
  useEffect(() => {
    if (data) {
      recordClientAudit({
        action: AuditActions.PRESCRIPTION_VIEWED,
        category: 'PharmacyOperations',
        details: 'Administrator opened a prescription operational record',
        resource: id,
        metadata: { status: data.status, clinicalVisible: canSeeClinical },
      });
    }
  }, [data, id, canSeeClinical]);

  if (detail.error) {
    return (
      <div className="space-y-6">
        <PageHeader
          breadcrumbs={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Operations' },
            { label: 'Pharmacy', href: '/pharmacy' },
            { label: 'Prescriptions', href: '/prescriptions' },
            { label: 'Detail' },
          ]}
          title="Prescription"
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
            { label: 'Pharmacy', href: '/pharmacy' },
            { label: 'Prescriptions', href: '/prescriptions' },
            { label: 'Detail' },
          ]}
          title="Prescription"
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
            { label: 'Pharmacy', href: '/pharmacy' },
            { label: 'Prescriptions', href: '/prescriptions' },
            { label: 'Detail' },
          ]}
          title="Prescription"
        />
        <Card>
          <EmptyState
            icon={Lock}
            title="Prescription not found"
            description="This prescription does not exist or is not accessible."
          />
          <div className="flex justify-center pb-6">
            <Link href="/prescriptions">
              <Button variant="outline">Back to Prescriptions</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const statusConfig = getStatusConfig(prescriptionStatusConfig, data.status);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Operations' },
          { label: 'Pharmacy', href: '/pharmacy' },
          { label: 'Prescriptions', href: '/prescriptions' },
          { label: data.id.slice(0, 8).toUpperCase() },
        ]}
        title={`Prescription ${data.id.slice(0, 8).toUpperCase()}…`}
        description="Operational workflow record. Status changes happen in the prescriber and pharmacy apps — this page observes."
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label={statusConfig.label} tone={statusConfig.tone} title={statusConfig.meaning} />
        {data.fulfilled_at && <Badge variant="success">Fulfilled {formatDateTime(data.fulfilled_at)}</Badge>}
        {!data.pharmacy_id && <Badge variant="warning">No pharmacy assigned</Badge>}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Workflow"
            description="Routing and lifecycle state — backend-authoritative."
          />
          <dl className="divide-y divide-border">
            <DetailRow label="Prescription ID">
              <span className="font-mono text-xs">{data.id}</span>
            </DetailRow>
            <DetailRow label="Status">{statusConfig.label}</DetailRow>
            <DetailRow label="Issued">{formatDateTime(data.created_at)}</DetailRow>
            <DetailRow label="Last updated">{formatRelativeTime(data.created_at)}</DetailRow>
            <DetailRow label="Fulfilled at">
              {data.fulfilled_at ? formatDateTime(data.fulfilled_at) : '—'}
            </DetailRow>
            <DetailRow label="Assigned pharmacy">
              {data.pharmacy_id ? (
                <Link
                  href={`/partners/pharmacy/${data.pharmacy_id}`}
                  className="text-primary underline-offset-2 hover:underline"
                >
                  Open pharmacy record
                </Link>
              ) : (
                '—'
              )}
            </DetailRow>
          </dl>
        </Card>

        <Card>
          <CardHeader title="People" description="Operational references — minimal identifiers only (§38)." />
          <dl className="divide-y divide-border">
            <DetailRow label="Patient">
              <Link
                href={`/users/${data.patient_id}`}
                className="inline-flex items-center gap-1.5 text-primary underline-offset-2 hover:underline"
              >
                <UserRound className="h-3.5 w-3.5" aria-hidden />
                Patient record
              </Link>
            </DetailRow>
            <DetailRow label="Prescriber">
              <Link
                href={`/partners/doctor/${data.doctor_id}`}
                className="inline-flex items-center gap-1.5 text-primary underline-offset-2 hover:underline"
              >
                <Stethoscope className="h-3.5 w-3.5" aria-hidden />
                Doctor record
              </Link>
            </DetailRow>
            <DetailRow label="Consultation">
              <Link
                href={`/appointments/${data.consultation_id}`}
                className="inline-flex items-center gap-1.5 text-primary underline-offset-2 hover:underline"
              >
                <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                Appointment record
              </Link>
            </DetailRow>
            <DetailRow label="Finance">
              <Link
                href="/finance"
                className="inline-flex items-center gap-1.5 text-primary underline-offset-2 hover:underline"
              >
                <Receipt className="h-3.5 w-3.5" aria-hidden />
                Transactions
              </Link>
            </DetailRow>
          </dl>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Medications"
          description="Names and dosage instructions as issued. Clinical guidance renders only with clinical permission (§13)."
        />
        <ul className="divide-y divide-border">
          {data.medications.map((med) => (
            <li key={med.medication_name + (med.dosage ?? '')} className="py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{med.medication_name}</p>
                <p className="text-xs text-foreground-muted">
                  {[med.dosage, med.frequency, med.duration].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
              {med.instructions &&
                (canSeeClinical ? (
                  <p className="mt-1 whitespace-pre-line text-xs text-foreground-muted">{med.instructions}</p>
                ) : (
                  <p className="mt-1 inline-flex items-center gap-1 text-xs text-foreground-subtle">
                    <Lock className="h-3 w-3" aria-hidden />
                    Medication instructions hidden — clinical permission required.
                  </p>
                ))}
            </li>
          ))}
          {!data.medications.length && <li className="py-3 text-sm text-foreground-subtle">No medication lines recorded.</li>}
        </ul>
      </Card>

      <Card>
        <CardHeader title="Clinical context" description="Prescriber diagnosis — the most sensitive field on this record (§13/§30)." />
        {canSeeClinical ? (
          data.diagnosis ? (
            <p className="whitespace-pre-line text-sm text-foreground">{data.diagnosis}</p>
          ) : (
            <p className="text-sm text-foreground-subtle">No diagnosis recorded.</p>
          )
        ) : (
          <p className="flex items-center gap-2 rounded-lg bg-neutral-subtle px-3 py-2.5 text-sm text-foreground-muted ring-1 ring-inset ring-border">
            <Lock className="h-4 w-4 shrink-0" aria-hidden />
            Diagnosis is restricted. This access is granted by the `prescriptions.clinical` permission and is audited
            every time it is used.
          </p>
        )}
      </Card>

      <p className="text-xs text-foreground-subtle">
        Fulfillment status changes belong to the assigned pharmacy partner app (§12); prescription status changes belong
        to the prescriber. No actions are offered here by design — the dashboard observes and coordinates (audit PL-1
        pattern; §46). Access to this record is audited (§40).
      </p>
    </div>
  );
}
