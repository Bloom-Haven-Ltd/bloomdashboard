'use client';

/**
 * User detail (§10) — identity, account state, and authorized contact with
 * PHI minimization (§57): no clinical sections by design; viewing a user
 * record is audited client-side (§15/§58).
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ShieldBan, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { useUserDetail, useUpdateUserStatus } from '@/features/users/hooks';
import { useToast } from '@/providers/ToastProvider';
import { useAuth } from '@/providers/AuthProvider';
import { recordClientAudit, AuditActions } from '@/lib/auth/auditClient';
import { formatDate, formatDateTime } from '@/lib/formatting/dates';
import { getStatusConfig, userStatusConfig } from '@/constants/status';
import { isPermission } from '@/lib/permissions';

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-xs font-semibold uppercase tracking-wider text-foreground-subtle">{label}</dt>
      <dd className="text-right text-sm text-foreground">{children}</dd>
    </div>
  );
}

export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const userId = params.id;
  const router = useRouter();
  const { can } = useAuth();

  const query = useUserDetail(userId);
  const statusMutation = useUpdateUserStatus();
  const { toast } = useToast();

  const [confirmTarget, setConfirmTarget] = useState<{ suspend: boolean } | null>(null);

  const canManage = isPermission('users.suspend') && can('users.suspend');

  // §15/§58: audit that this administrator viewed a user record.
  useEffect(() => {
    if (query.data) {
      recordClientAudit({
        action: AuditActions.USER_VIEWED,
        category: 'UserManagement',
        details: 'Administrator opened a user record',
        resource: query.data.id,
      });
    }
  }, [query.data]);

  // ── States ──
  if (query.error) {
    return (
      <DetailShell breadcrumbs={[{ label: 'Users' }]} title="User">
        <Card>
          <ErrorState
            code={query.error.code}
            message={query.error.message}
            requestId={query.error.requestId}
            onRetry={() => void query.refetch()}
          />
        </Card>
      </DetailShell>
    );
  }

  if (query.isLoading) {
    return (
      <DetailShell breadcrumbs={[{ label: 'Users' }]} title="User">
        <Card>
          <EmptyState title="Loading user…" description="Fetching the account record." />
        </Card>
      </DetailShell>
    );
  }

  if (query.data === null || query.data === undefined) {
    return (
      <DetailShell breadcrumbs={[{ label: 'Users' }]} title="User">
        <Card>
          <EmptyState
            icon={ArrowLeft}
            title="User not found"
            description="This account does not exist or you are not authorized to view it."
            action={
              <Button variant="outline" onClick={() => router.push('/users')}>
                Back to directory
              </Button>
            }
          />
        </Card>
      </DetailShell>
    );
  }

  const user = query.data;
  const status = getStatusConfig(userStatusConfig, user.is_active ? 'active' : 'suspended');

  return (
    <DetailShell
      breadcrumbs={[{ label: 'Users', href: '/users' }, { label: user.display_name }]}
      title={user.display_name}
      description={`User ID ${user.id}`}
      actions={
        canManage &&
        (user.is_active ? (
          <Button variant="danger" size="sm" onClick={() => setConfirmTarget({ suspend: true })}>
            <ShieldBan className="h-4 w-4" aria-hidden />
            Suspend account
          </Button>
        ) : (
          <Button size="sm" onClick={() => setConfirmTarget({ suspend: false })}>
            <ShieldCheck className="h-4 w-4" aria-hidden />
            Reactivate account
          </Button>
        ))
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Identity (§10) */}
        <Card className="lg:col-span-2">
          <div className="flex items-center gap-4">
            <Avatar name={user.display_name} src={user.profile_picture ?? undefined} size="lg" />
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-foreground">{user.display_name}</h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <Badge variant={user.role === 'admin' ? 'primary' : 'neutral'}>{user.role}</Badge>
                <StatusBadge label={status.label} tone={status.tone} title={status.meaning} />
                {user.is_verified && <Badge variant="success">Verified</Badge>}
                {user.provider_verified && <Badge variant="info">Provider verified</Badge>}
              </div>
            </div>
          </div>

          <dl className="mt-6 divide-y divide-border/60">
            <DetailRow label="User ID"><span className="font-mono text-xs">{user.id}</span></DetailRow>
            <DetailRow label="Role">{user.role}</DetailRow>
            <DetailRow label="Registration date">{formatDate(user.created_at)}</DetailRow>
            <DetailRow label="Last login">{user.last_login ? formatDateTime(user.last_login) : 'Never recorded'}</DetailRow>
            <DetailRow label="Last updated">{user.updated_at ? formatDateTime(user.updated_at) : '—'}</DetailRow>
            <DetailRow label="Timezone">{user.timezone ?? '—'}</DetailRow>
          </dl>
        </Card>

        {/* Contact + relationships (§10 — authorized contact info only, §57) */}
        <div className="space-y-4">
          <Card>
            <CardHeader title="Contact" description="Minimum necessary contact information." />
            <dl className="mt-2 divide-y divide-border/60">
              <DetailRow label="Email">
                {user.email ? (
                  <a href={`mailto:${user.email}`} className="text-primary hover:underline">
                    {user.email}
                  </a>
                ) : (
                  '—'
                )}
              </DetailRow>
              <DetailRow label="Phone">
                {user.phone_number ? (
                  <a href={`tel:${user.phone_number}`} className="text-primary hover:underline">
                    {user.phone_number}
                  </a>
                ) : (
                  '—'
                )}
              </DetailRow>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Relationships" description="Records this user appears in." />
            <p className="mt-2 text-sm text-foreground-muted">
              Cross-record navigation (appointments, orders, payments) arrives with the backend
              per-user aggregates — see{' '}
              <span className="font-mono text-xs">docs/admin/users-partners-audit.md</span>.
            </p>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmTarget !== null}
        onClose={() => setConfirmTarget(null)}
        onConfirm={handleStatusChange}
        busy={statusMutation.isPending}
        strings={
          user
            ? {
                title: confirmTarget?.suspend ? 'Suspend account?' : 'Reactivate account?',
                consequence: confirmTarget?.suspend
                  ? `${user.display_name} will immediately lose access to the platform.`
                  : `${user.display_name} will regain platform access.`,
                confirmLabel: confirmTarget?.suspend ? 'Suspend account' : 'Reactivate',
                requireReason: true,
              }
            : { title: '', consequence: '' }
        }
      />
    </DetailShell>
  );

  async function handleStatusChange(reason: string) {
    if (!user) return;
    try {
      await statusMutation.mutateAsync({ userId: user.id, isActive: !confirmTarget?.suspend });
      toast({
        variant: 'success',
        title: confirmTarget?.suspend ? 'Account suspended' : 'Account reactivated',
        description: `${user.display_name} — recorded reason: “${reason}”`,
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'The change could not be applied.';
      toast({ variant: 'error', title: 'Status change failed', description: message });
      throw cause;
    }
  }
}

/** Shared shell so every return path renders the same page header. */
function DetailShell({
  breadcrumbs,
  title,
  description,
  actions,
  children,
}: {
  breadcrumbs: Parameters<typeof PageHeader>[0]['breadcrumbs'];
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'People' }, ...breadcrumbs]}
        title={title}
        description={description}
        actions={actions}
      />
      {children}
    </div>
  );
}
