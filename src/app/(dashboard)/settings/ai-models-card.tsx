'use client';

/**
 * AI assistant model registry (§6/§27) — multiple models, added right here:
 * label + model id + API key, and the backend provider layer starts using
 * them on the very next patient message, tried in priority order with
 * automatic failover when one model errors.
 *
 * Backend-authoritative by construction: the raw API key travels one way
 * (admin → server) and never comes back — the list shows only the masked
 * preview the server hands out. Editing a model without typing a new key
 * keeps the stored one ("" means "leave alone" server-side). While nothing
 * is configured here the assistant keeps running on the server env
 * configuration, so adding the first model is a live swap, not a deploy.
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Switch } from '@/components/ui/Switch';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/EmptyState';
import {
  createAiModel,
  deleteAiModel,
  fetchAiModels,
  updateAiModel,
} from '@/features/settings/service';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useToast } from '@/providers/ToastProvider';
import type { AiModelConfigDto } from '@/lib/api/schemas';

const aiModelKeys = {
  list: ['settings', 'ai-models'] as const,
};

const DEFAULT_BASE_URL = 'https://router.huggingface.co/v1';

interface ModelDraft {
  id?: string;
  label: string;
  model: string;
  base_url: string;
  /** Raw key — only ever sent, never stored in view state after save. */
  api_key: string;
  priority: number;
  is_enabled: boolean;
}

const emptyDraft: ModelDraft = {
  label: '',
  model: '',
  base_url: DEFAULT_BASE_URL,
  api_key: '',
  priority: 100,
  is_enabled: true,
};

export function AiModelsCard() {
  const query = useApiQuery(aiModelKeys.list, (signal) => fetchAiModels(signal));
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [draft, setDraft] = useState<ModelDraft | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AiModelConfigDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: aiModelKeys.list });
  };

  const saveMutation = useMutation({
    mutationFn: (d: ModelDraft) => {
      const fields = {
        label: d.label.trim(),
        model: d.model.trim(),
        base_url: d.base_url.trim(),
        priority: d.priority,
        is_enabled: d.is_enabled,
      };
      if (d.id) {
        // Blank key = keep the stored one; only a typed key is shipped.
        const key = d.api_key.trim();
        return updateAiModel(d.id, key ? { ...fields, api_key: key } : fields);
      }
      return createAiModel({ ...fields, api_key: d.api_key.trim(), provider: 'huggingface' });
    },
    onSuccess: () => {
      invalidate();
      toast({
        variant: 'success',
        title: draft?.id ? 'Model updated' : 'Model added',
        description: 'The assistant uses it from the next patient message onward.',
      });
      setDraft(null);
      setError(null);
    },
    onError: (cause: Error) => setError(cause.message || 'The model could not be saved.'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_enabled }: { id: string; is_enabled: boolean }) =>
      updateAiModel(id, { is_enabled }),
    onSettled: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAiModel(id),
    onSuccess: () => {
      invalidate();
      setPendingDelete(null);
      toast({ variant: 'success', title: 'Model removed', description: 'Failover order updated.' });
    },
    onError: (cause: Error) =>
      toast({ variant: 'error', title: 'Removal failed', description: cause.message }),
  });

  const openEditor = (row: AiModelConfigDto) => {
    setDraft({
      id: row.id,
      label: row.label,
      model: row.model,
      base_url: row.base_url,
      api_key: '', // masked preview is display-only; blank means keep
      priority: row.priority,
      is_enabled: row.is_enabled,
    });
    setError(null);
  };

  const submit = () => {
    if (!draft) return;
    if (!draft.label.trim() || !draft.model.trim()) {
      setError('Label and model id are required.');
      return;
    }
    if (!/^https?:\/\//.test(draft.base_url.trim())) {
      setError('Base URL must start with http:// or https://.');
      return;
    }
    if (!draft.id && draft.api_key.trim().length < 8) {
      setError('An API key of at least 8 characters is required to add a model.');
      return;
    }
    void saveMutation.mutateAsync(draft);
  };

  const items = query.data ?? [];

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <CardHeader
          title="AI assistant models"
          description="Multiple models with failover, tried in priority order. Keys stay on the server."
        />
        <Button
          size="sm"
          onClick={() => {
            setDraft({ ...emptyDraft });
            setError(null);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add model
        </Button>
      </div>

      {query.isLoading ? (
        <TableSkeleton rows={3} columns={3} />
      ) : query.error ? (
        <ErrorState
          code={query.error.code}
          message={query.error.message}
          requestId={query.error.requestId}
          onRetry={() => void query.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="No models configured yet"
          description="Until you add one here, the assistant runs on the server's env configuration. Add a model id and its API key to switch to the dashboard-managed registry."
        />
      ) : (
        <ul className="divide-y divide-border/60">
          {items.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-4 px-6 py-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{row.label}</p>
                <p className="truncate font-mono text-xs text-foreground-muted">{row.model}</p>
                <p className="mt-0.5 truncate text-[11px] text-foreground-subtle">{row.base_url}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <Badge variant={row.is_enabled ? 'success' : 'neutral'}>
                  {row.is_enabled ? 'enabled' : 'disabled'}
                </Badge>
                <Badge variant="neutral">P{row.priority}</Badge>
                <span className="rounded-lg bg-surface-muted px-2.5 py-1.5 font-mono text-xs text-foreground-muted">
                  {row.api_key_masked}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={toggleMutation.isPending}
                  onClick={() =>
                    toggleMutation.mutate({ id: row.id, is_enabled: !row.is_enabled })
                  }
                  aria-label={`${row.is_enabled ? 'Disable' : 'Enable'} ${row.label}`}
                >
                  {row.is_enabled ? 'Disable' : 'Enable'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEditor(row)}
                  aria-label={`Edit ${row.label}`}
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPendingDelete(row)}
                  aria-label={`Remove ${row.label}`}
                >
                  <Trash2 className="h-4 w-4 text-danger" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Add / edit modal */}
      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? `Edit ${draft.label}` : 'Add an AI model'}
        description="Saved server-side and audited; the assistant starts using it on the next patient message."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDraft(null)} disabled={saveMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={submit} isLoading={saveMutation.isPending}>
              {draft?.id ? 'Save changes' : 'Add model'}
            </Button>
          </>
        }
      >
        {draft && (
          <div className="space-y-4">
            <Input
              label="Label"
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              hint={'How you\'ll recognize it in this list, e.g. "Qwen primary".'}
            />
            <Input
              label="Model id"
              value={draft.model}
              onChange={(e) => setDraft({ ...draft, model: e.target.value })}
              placeholder="Qwen/Qwen3-4B-Instruct-2507:featherless-ai"
              hint={'Exact model id; a ":provider" suffix pins the router provider.'}
            />
            <Input
              label="Base URL"
              value={draft.base_url}
              onChange={(e) => setDraft({ ...draft, base_url: e.target.value })}
              hint="OpenAI-compatible endpoint. Default is the Hugging Face router."
            />
            <Input
              label="API key"
              type="password"
              value={draft.api_key}
              onChange={(e) => setDraft({ ...draft, api_key: e.target.value })}
              autoComplete="off"
              required={!draft.id}
              hint={
                draft.id
                  ? 'Stored on the server and never shown again — leave blank to keep the current key, paste a new one to rotate it.'
                  : 'Stored server-side only. It never leaves this field except as the masked preview.'
              }
            />
            <Input
              label="Priority"
              type="number"
              min={1}
              max={1000}
              value={String(draft.priority)}
              onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) || 100 })}
              hint="Lower is tried first. If this model errors, the next one takes over."
            />
            <Switch
              label="Enabled"
              description="Disabled models stay configured but are skipped."
              checked={draft.is_enabled}
              onCheckedChange={(checked) => setDraft({ ...draft, is_enabled: checked })}
            />
            {error && (
              <p role="alert" className="text-xs font-medium text-danger">
                {error}
              </p>
            )}
          </div>
        )}
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title={pendingDelete ? `Remove ${pendingDelete.label}?` : 'Remove model'}
        description="The stored API key is deleted with it. Remaining models keep serving in priority order."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingDelete(null)} disabled={deleteMutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
              isLoading={deleteMutation.isPending}
            >
              Remove model
            </Button>
          </>
        }
      >
        {pendingDelete && (
          <p className="text-sm text-foreground-muted">
            <span className="font-mono">{pendingDelete.model}</span> will no longer be
            tried for patient messages.
          </p>
        )}
      </Modal>
    </Card>
  );
}
