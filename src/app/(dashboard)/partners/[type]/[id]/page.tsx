'use client';

/**
 * Partner detail (§19/§22) — shared architecture, type-specific sections via
 * discriminated union. Renders only verified response fields. Verification
 * documents are metadata-only until the backend signs-URL capability exists
 * (docs/admin/users-partners-audit.md, §23/§24).
 */

import { use, useEffect } from 'react';
import Link from 'next/link';
import { Building2, FlaskConical, Stethoscope } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { usePartnerDetail } from '@/features/partners/hooks';
import { usePendingVerifications } from '@/features/verification/hooks';
import { recordClientAudit, AuditActions } from '@/lib/auth/auditClient';
import { formatDate, formatDateTime } from '@/lib/formatting/dates';
import { formatGhs } from '@/lib/formatting/money';
import { getStatusConfig, partnerStatusConfig, verificationStatusConfig } from '@/constants/status';
import { isPermission } from '@/lib/permissions';
import { useAuth } from '@/providers/AuthProvider';
import type { PartnerType } from '@/features/partners/service';

const TYPE_META = {
  doctor: { icon: Stethoscope, label: 'Doctor' },
  lab: { icon: FlaskConical, label: 'Laboratory' },
  pharmacy: { icon: Building2, label: 'Pharmacy' },
} as const;

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-xs font-semibold uppercase tracking-wider text-foreground-subtle">{label}</dt>
      <dd className="text-right text-sm text-foreground">{children}</dd>
    </div>
  );
}

export default function PartnerDetailPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const { type: rawType, id } = use(params);
  const type = (['doctor', 'lab', 'pharmacy'].includes(rawType) ? rawType : 'doctor') as PartnerType;
  const { icon: TypeIcon, label: typeLabel } = TYPE_META[type];

  const { can } = useAuth();
  const query = usePartnerDetail(type, id);
  const verificationQueue = usePendingVerifications();

  // §15/§58: audit partner profile views (documents metadata below likewise).
  useEffect(() => {
    if (query.data) {
      recordClientAudit({
        action: AuditActions.PARTNER_VIEWED,
        category: 'PartnerManagement',
        details: 'Administrator opened a partner profile',
        resource: id,
      });
    }
  }, [query.data, id]);

  // §21: verification context comes from the queue when this partner is pending.
  const verificationEntry = verificationQueue.data?.find((entry) => entry.id === id) ?? null;

  if (query.error) {
    return (
      <div className="space-y-6">
        <PageHeader breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Partners' }]} title="Partner" />
        <Card>
          <ErrorState
            code={query.error.code}
            message={query.error.message}
            requestId={query.error.requestId}
            onRetry={() => void query.refetch()}
          />
        </Card>
      </div>
    );
  }

  if (query.data === undefined) {
    return (
      <div className="space-y-6">
        <PageHeader breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Partners' }]} title="Partner" />
        <Card>
          <EmptyState
            title="Partner not found"
            description="This profile does not exist or is currently unavailable."
          />
        </Card>
      </div>
    );
  }

  const data = query.data;

  const displayName =
    data.kind === 'lab' || data.kind === 'pharmacy'
      ? data.name
      : [data.first_name, data.last_name].filter(Boolean).join(' ') || 'Doctor profile';

  const verificationStatus = (() => {
    if (data.kind === 'pharmacy') return getStatusConfig(partnerStatusConfig, data.status);
    return data.is_verified ? verificationStatusConfig.approved : verificationStatusConfig.pending;
  })();

  const canReviewVerification =
    isPermission('verification.read') && can('verification.read') && verificationEntry !== null;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'People', href: '/users' },
          { label: 'Partners', href: `/partners?type=${type}` },
          { label: displayName },
        ]}
        title={displayName}
        description={`Partner ID ${id}`}
        actions={
          canReviewVerification && verificationEntry ? (
            <Link href={`/verification/${verificationEntry.id}`}>
              <Button variant="outline" size="sm">
                Review in Verification Center
              </Button>
            </Link>
          ) : null
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Identity header (§20) */}
        <Card className="lg:col-span-2">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-subtle text-primary">
              <TypeIcon className="h-6 w-6" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-foreground">{displayName}</h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <Badge variant="primary">{typeLabel}</Badge>
                <StatusBadge
                  label={verificationStatus.label}
                  tone={verificationStatus.tone}
                  title={verificationStatus.meaning}
                />
              </div>
            </div>
          </div>

          <dl className="mt-6 divide-y divide-border/60">
            <DetailRow label="Partner ID"><span className="font-mono text-xs">{id}</span></DetailRow>
            <DetailRow label="Registered">{formatDate(data.created_at)}</DetailRow>
            <DetailRow label="Last updated">{data.updated_at ? formatDateTime(data.updated_at) : '—'}</DetailRow>
            <DetailRow label="Rating">
              {data.rating != null ? `${data.rating.toFixed(1)} (${data.total_reviews ?? 0} reviews)` : '—'}
            </DetailRow>
            {data.kind === 'doctor' && data.bio && (
              <div className="py-3">
                <dt className="text-xs font-semibold uppercase tracking-wider text-foreground-subtle">Professional bio</dt>
                <dd className="mt-1 text-sm leading-relaxed text-foreground-muted">{data.bio}</dd>
              </div>
            )}
          </dl>
        </Card>

        {/* Verification + documents metadata (§21/§23) */}
        <div className="space-y-4">
          <Card>
            <CardHeader title="Verification" description="Backend-authoritative verification state." />
            <dl>
              <DetailRow label="Status">
                <StatusBadge
                  label={verificationStatus.label}
                  tone={verificationStatus.tone}
                  title={verificationStatus.meaning}
                />
              </DetailRow>
              {verificationEntry && (
                <>
                  <DetailRow label="License">{verificationEntry.license_number ?? '—'}</DetailRow>
                  <DetailRow label="Submitted">{formatDateTime(verificationEntry.created_at)}</DetailRow>
                </>
              )}
            </dl>
            {verificationEntry?.documents && Object.keys(verificationEntry.documents).length > 0 && (
              <div className="mt-3 rounded-lg bg-surface-muted p-3">
                <p className="text-xs font-semibold text-foreground">Submitted documents (metadata only)</p>
                <ul className="mt-1.5 space-y-1">
                  {Object.entries(verificationEntry.documents).map(([key, value]) => (
                    <li key={key} className="text-xs text-foreground-muted">
                      <span className="font-medium capitalize">{key.replaceAll('_', ' ')}</span>
                      {value !== null && typeof value === 'object'
                        ? ` — ${Object.keys(value as Record<string, unknown>).length} field(s)`
                        : ''}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] leading-relaxed text-foreground-subtle">
                  Document files are not viewable from the dashboard until the backend issues
                  short-lived signed URLs (see docs/admin/users-partners-audit.md).
                </p>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Professional information" />
            <dl className="divide-y divide-border/60">
              {data.kind === 'doctor' && (
                <>
                  <DetailRow label="Specialty">{data.specialty}</DetailRow>
                  <DetailRow label="Experience">{data.experience_years} years</DetailRow>
                  <DetailRow label="Consultation fee">{formatGhs(data.consultation_fee)}</DetailRow>
                  <DetailRow label="Languages">{data.languages?.length ? data.languages.join(', ') : '—'}</DetailRow>
                  <DetailRow label="License number">{data.license_number ?? '—'}</DetailRow>
                  <DetailRow label="Education entries">{data.education?.length ?? 0}</DetailRow>
                  <DetailRow label="Certifications">{data.certifications?.length ?? 0}</DetailRow>
                  <DetailRow label="Currently online">{data.is_online ? 'Yes' : 'No'}</DetailRow>
                </>
              )}
              {data.kind === 'lab' && (
                <>
                  <DetailRow label="Laboratory name">{data.name}</DetailRow>
                  <DetailRow label="Reviews">{data.total_reviews ?? 0}</DetailRow>
                </>
              )}
              {data.kind === 'pharmacy' && (
                <>
                  <DetailRow label="Pharmacy type">{data.pharmacy_type}</DetailRow>
                  <DetailRow label="License number">{data.license_number ?? '—'}</DetailRow>
                  <DetailRow label="Address">{data.address ?? '—'}</DetailRow>
                  <DetailRow label="Ghana Post GPS">{data.ghana_post_gps ?? '—'}</DetailRow>
                  <DetailRow label="Delivery radius">
                    {data.delivery_radius_km != null ? `${data.delivery_radius_km} km` : '—'}
                  </DetailRow>
                  <DetailRow label="Delivery fee">{formatGhs(data.delivery_fee)}</DetailRow>
                  <DetailRow label="Minimum order">{formatGhs(data.minimum_order_amount)}</DetailRow>
                  <DetailRow label="Contact phone">{data.contact_phone ?? '—'}</DetailRow>
                  <DetailRow label="Contact email">{data.contact_email ?? '—'}</DetailRow>
                </>
              )}
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
