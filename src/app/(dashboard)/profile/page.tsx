'use client';

/**
 * Admin profile — session identity and active session management
 * (GET /auth/sessions, DELETE /auth/sessions/{id} — verified endpoints).
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { MonitorSmartphone } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api/client';
import { parseWith, listSchema } from '@/lib/api/schemas';
import { formatDateTime } from '@/lib/formatting/dates';
import { z } from 'zod';

type ActiveSession = z.infer<typeof activeSessionSchema>;

const activeSessionSchema = z.object({
  id: z.string().uuid(),
  app_type: z.string().nullable().optional(),
  device_name: z.string().nullable().optional(),
  platform: z.string().nullable().optional(),
  created_at: z.string().min(1),
  last_active_at: z.string().min(1).nullable().optional(),
  is_current: z.boolean().optional(),
});

const sessionsKeys = { list: ['auth', 'sessions'] as const };

async function fetchActiveSessions(signal?: AbortSignal): Promise<ActiveSession[]> {
  const data = await api.get<unknown>('/auth/sessions', { signal });
  return parseWith(listSchema(activeSessionSchema), data);
}

export default function ProfilePage() {
  const { adminUser, logout } = useAuth();
  const { toast } = useToast();
  const sessions = useApiQuery(sessionsKeys.list, (signal) => fetchActiveSessions(signal));

  const revokeMutation = useMutation({
    mutationFn: (sessionId: string) => api.delete(`/auth/sessions/${sessionId}`),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Session revoked' });
      void sessions.refetch();
    },
    onError: () => {
      toast({ variant: 'error', title: 'Could not revoke session', description: 'Try again or sign out everywhere.' });
    },
  });

  const [confirmAll, setConfirmAll] = useState(false);

  const items = sessions.data ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">Profile</h2>
        <p className="mt-0.5 text-sm text-slate-500">Your administrator identity and active sessions.</p>
      </header>

      <Card>
        <CardHeader title="Identity" description="Validated against the platform backend on every session." />
        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-bold uppercase tracking-widest text-slate-400">Name</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-900">
              {adminUser ? `${adminUser.first_name ?? ''} ${adminUser.last_name ?? ''}`.trim() || '—' : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-widest text-slate-400">Email</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-900">{adminUser?.email ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-widest text-slate-400">Role</dt>
            <dd className="mt-1"><Badge variant="primary">admin</Badge></dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-widest text-slate-400">Verification</dt>
            <dd className="mt-1">
              <Badge variant={adminUser?.is_verified ? 'success' : 'warning'}>
                {adminUser?.is_verified ? 'verified' : 'unverified'}
              </Badge>
            </dd>
          </div>
        </dl>
      </Card>

      <Card padding="none" className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <CardHeader title="Active sessions" description="Devices currently holding a backend session." />
          <Button variant="outline" size="sm" onClick={() => setConfirmAll(true)}>
            Sign out everywhere
          </Button>
        </div>
        {sessions.isLoading ? (
          <TableSkeleton rows={3} columns={3} />
        ) : sessions.error ? (
          <ErrorState
            code={sessions.error.code}
            message={sessions.error.message}
            onRetry={() => void sessions.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState icon={MonitorSmartphone} title="No active sessions" description="Session data is unavailable." />
        ) : (
          <ul className="divide-y divide-slate-50">
            {items.map((session) => (
              <li key={session.id} className="flex items-center justify-between gap-4 px-6 py-4">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {session.device_name ?? session.app_type ?? 'Unknown device'}{' '}
                    {session.is_current && <Badge variant="success">this device</Badge>}
                  </p>
                  <p className="text-xs text-slate-500">
                    {session.platform ?? 'web'} · started {formatDateTime(session.created_at)}
                    {session.last_active_at ? ` · last active ${formatDateTime(session.last_active_at)}` : ''}
                  </p>
                </div>
                {!session.is_current && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:bg-red-50"
                    disabled={revokeMutation.isPending}
                    onClick={() => revokeMutation.mutate(session.id)}
                  >
                    Revoke
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={confirmAll}
        onClose={() => setConfirmAll(false)}
        strings={{
          title: 'Sign out everywhere?',
          consequence: 'All backend sessions for your account will be revoked, including this one. You will need to sign in again.',
          confirmLabel: 'Revoke all sessions',
          requirePhrase: 'sign out',
        }}
        onConfirm={async () => {
          setConfirmAll(false);
          await logout();
        }}
      />
    </div>
  );
}
