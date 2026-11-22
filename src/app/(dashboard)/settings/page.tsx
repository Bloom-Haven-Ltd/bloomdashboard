'use client';

/**
 * Platform settings (§6/§27) — values are backend-authoritative; edits are
 * submitted to PATCH /admin/settings/{key} and audited server-side.
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/EmptyState';
import { fetchSystemSettings, updateSystemSetting } from '@/features/settings/service';
import { AiModelsCard } from './ai-models-card';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useToast } from '@/providers/ToastProvider';
import type { SystemSettingDto } from '@/lib/api/schemas';

const settingsKeys = {
  list: ['settings', 'list'] as const,
};

export default function SettingsPage() {
  const query = useApiQuery(settingsKeys.list, (signal) => fetchSystemSettings(signal));
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [editing, setEditing] = useState<SystemSettingDto | null>(null);
  const [draftValue, setDraftValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const updateMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => updateSystemSetting(key, value),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: settingsKeys.list });
    },
  });

  const items = query.data ?? [];

  const openEditor = (setting: SystemSettingDto) => {
    setEditing(setting);
    setDraftValue(setting.value);
    setError(null);
  };

  const submitUpdate = async () => {
    if (!editing) return;
    if (draftValue === editing.value) {
      setError('The value has not changed.');
      return;
    }
    try {
      await updateMutation.mutateAsync({ key: editing.key, value: draftValue });
      toast({ variant: 'success', title: 'Setting updated', description: `${editing.key} saved and audited.` });
      setEditing(null);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'The update could not be saved.';
      setError(message);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">Platform settings</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Global configuration managed by the backend. Every change is audited.
        </p>
      </header>

      <Card padding="none" className="overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <CardHeader title="System configuration" description="Applied platform-wide immediately after save." />
        </div>
        {query.isLoading ? (
          <TableSkeleton rows={6} columns={3} />
        ) : query.error ? (
          <ErrorState
            code={query.error.code}
            message={query.error.message}
            requestId={query.error.requestId}
            onRetry={() => void query.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState title="No settings exposed" description="The backend has not published any configurable settings." />
        ) : (
          <ul className="divide-y divide-slate-50">
            {items.map((setting) => (
              <li key={setting.key} className="flex items-center justify-between gap-4 px-6 py-4">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-semibold text-slate-800">{setting.key}</p>
                  {setting.description && <p className="text-xs text-slate-500">{setting.description}</p>}
                  <p className="mt-0.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">{setting.type}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="max-w-[16rem] truncate rounded-lg bg-slate-50 px-3 py-1.5 font-mono text-xs text-slate-600">
                    {setting.value}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditor(setting)}
                    aria-label={`Edit ${setting.key}`}
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                    Edit
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Multi-model AI assistant registry — keys added right here, no redeploy. */}
      <AiModelsCard />

      {/* Edit modal */}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? `Edit ${editing.key}` : 'Edit setting'}
        description="Changes apply platform-wide and are recorded in the audit trail."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={updateMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={submitUpdate} isLoading={updateMutation.isPending}>
              Save change
            </Button>
          </>
        }
      >
        {editing && (
          <Input
            label={editing.key}
            value={draftValue}
            onChange={(event) => {
              setDraftValue(event.target.value);
              setError(null);
            }}
            error={error}
            hint={editing.description ?? undefined}
          />
        )}
      </Modal>
    </div>
  );
}
