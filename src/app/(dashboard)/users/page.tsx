'use client';

/**
 * User directory (§14/§29-§33) — the reference implementation for list pages:
 * PageHeader + DataTable, URL-persisted filters (§31), backend-authorized
 * suspend/reactivate with confirmation (§32).
 */

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldBan, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type DataTableColumn } from '@/components/data-display/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { StatusBadge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Avatar } from '@/components/ui/Avatar';
import { useUsers, useUpdateUserStatus } from '@/features/users/hooks';
import { useToast } from '@/providers/ToastProvider';
import { formatDate } from '@/lib/formatting/dates';
import { getStatusConfig, userStatusConfig } from '@/constants/status';
import type { UserDto } from '@/lib/api/schemas';

const ROLE_OPTIONS = [
  { value: 'all', label: 'All roles' },
  { value: 'patient', label: 'Patients' },
  { value: 'doctor', label: 'Doctors' },
  { value: 'lab', label: 'Laboratories' },
  { value: 'pharmacy', label: 'Pharmacies' },
  { value: 'admin', label: 'Administrators' },
];

interface TargetUser {
  user: UserDto;
  suspend: boolean;
}

export default function UsersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── URL state (§31) ──
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const role = searchParams.get('role') ?? 'all';
  const search = searchParams.get('search') ?? '';

  const [searchDraft, setSearchDraft] = useState(search);
  useEffect(() => setSearchDraft(search), [search]);

  const setParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === '' || (key === 'page' && value === '1') || (key === 'role' && value === 'all')) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }
    router.replace(`/users${next.toString() ? `?${next.toString()}` : ''}`);
  };

  useEffect(() => {
    if (searchDraft === search) return;
    const timer = setTimeout(() => setParams({ search: searchDraft || null, page: null }), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft]);

  const query = useUsers({ page, pageSize: 20, role, search });
  const statusMutation = useUpdateUserStatus();
  const { toast } = useToast();
  const [confirmTarget, setConfirmTarget] = useState<TargetUser | null>(null);

  const handleStatusChange = async (reason: string) => {
    if (!confirmTarget) return;
    try {
      await statusMutation.mutateAsync({
        userId: confirmTarget.user.id,
        isActive: !confirmTarget.suspend,
      });
      toast({
        variant: 'success',
        title: confirmTarget.suspend ? 'Account suspended' : 'Account reactivated',
        description: `${confirmTarget.user.email} — recorded reason: “${reason}”`,
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'The change could not be applied.';
      toast({ variant: 'error', title: 'Status change failed', description: message });
      throw cause;
    }
  };

  const users = query.data?.users ?? [];

  const columns: Array<DataTableColumn<UserDto>> = [
    {
      key: 'user',
      header: 'User',
      cell: (user) => (
        <div className="flex items-center gap-3">
          <Avatar name={`${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.email} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">
              {[user.first_name, user.last_name].filter(Boolean).join(' ') || 'Unnamed account'}
            </p>
            <p className="truncate text-xs text-foreground-muted">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      hideBelow: 'sm',
      cell: (user) => <Badge variant={user.role === 'admin' ? 'primary' : 'neutral'}>{user.role}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (user) => {
        const status = getStatusConfig(userStatusConfig, user.is_active ? 'active' : 'suspended');
        return <StatusBadge label={status.label} tone={status.tone} title={status.meaning} />;
      },
    },
    {
      key: 'registered',
      header: 'Registered',
      hideBelow: 'md',
      cell: (user) => <span className="text-foreground-muted">{formatDate(user.created_at)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (user) =>
        user.is_active ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-danger hover:bg-danger-subtle"
            onClick={() => setConfirmTarget({ user, suspend: true })}
          >
            <ShieldBan className="h-4 w-4" aria-hidden />
            Suspend
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setConfirmTarget({ user, suspend: false })}>
            <ShieldCheck className="h-4 w-4" aria-hidden />
            Reactivate
          </Button>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'People' }, { label: 'All Users' }]}
        title="People"
        description="Directory of platform accounts. Suspension and reactivation are backend-authorized and audited."
      />

      <DataTable<UserDto>
        columns={columns}
        rows={users}
        getRowKey={(user) => user.id}
        page={query.data?.page}
        totalPages={query.data?.totalPages}
        total={query.data?.total}
        pageSize={query.data?.pageSize}
        onPageChange={(next) => setParams({ page: String(next) })}
        loading={query.isLoading}
        error={
          query.error
            ? { code: query.error.code, message: query.error.message, requestId: query.error.requestId }
            : null
        }
        onRetry={() => void query.refetch()}
        emptyTitle="No users found"
        emptyDescription="No accounts match the current filters. Adjust the search or role filter."
        toolbar={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1">
              <Input
                label="Search users"
                hideLabel
                placeholder="Search by name or email…"
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                type="search"
              />
            </div>
            <div className="w-full sm:w-52">
              <Select
                label="Filter by role"
                hideLabel
                options={ROLE_OPTIONS}
                value={role}
                onChange={(event) =>
                  setParams({ role: event.target.value === 'all' ? null : event.target.value, page: null })
                }
              />
            </div>
          </div>
        }
      />

      <ConfirmDialog
        open={confirmTarget !== null}
        onClose={() => setConfirmTarget(null)}
        onConfirm={handleStatusChange}
        busy={statusMutation.isPending}
        strings={
          confirmTarget
            ? {
                title: confirmTarget.suspend ? 'Suspend account?' : 'Reactivate account?',
                consequence: confirmTarget.suspend
                  ? `${confirmTarget.user.email} will immediately lose access to the platform.`
                  : `${confirmTarget.user.email} will regain platform access.`,
                confirmLabel: confirmTarget.suspend ? 'Suspend account' : 'Reactivate',
                requireReason: true,
              }
            : { title: '', consequence: '' }
        }
      />
    </div>
  );
}
