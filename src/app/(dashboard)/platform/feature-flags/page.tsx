'use client';

/**
 * Feature flags (§42/§43/§44) — strictly read-only. The backend exposes a
 * role-aware boolean dict via GET /feature-flags and has NO admin mutation
 * endpoint (audit PS-8), so there is deliberately no toggle here: enabling or
 * disabling flags is a backend/code deployment concern. Each flag's meaning
 * is the key itself; no descriptions or owners exist to display.
 */

import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { EmptyState } from '@/components/ui/EmptyState';
import { useFeatureFlags } from '@/features/platform/hooks';

export default function FeatureFlagsPage() {
  const flags = useFeatureFlags();
  const entries = Object.entries(flags.data?.flags ?? {});

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Platform', href: '/platform' }, { label: 'Feature Flags' }]}
        title="Feature flags"
        description="Backend-owned runtime flags for the platform's client applications, resolved for the admin role. Read-only: no admin mutation endpoint exists."
      />

      <Alert
        variant="info"
        title="Flags are backend-owned"
        description="Values come from GET /feature-flags and change only through backend deployment or configuration. The dashboard intentionally offers no toggle — flag changes must go through the backend's own controls (platform-audit.md PS-8)."
      />

      <Card>
        <CardHeader title="Flags (admin role view)" description="Booleans exactly as served by the backend." />
        {flags.isLoading ? (
          <p className="mt-3 text-sm text-foreground-muted">Loading flags…</p>
        ) : flags.isError ? (
          <p className="mt-3 text-sm text-danger">Flags could not be loaded: {flags.error.message}</p>
        ) : entries.length === 0 ? (
          <EmptyState title="No flags returned" description="The backend returned no flags for this role." />
        ) : (
          <div className="mt-3 divide-y divide-border">
            {entries.map(([key, value]) => (
              <div key={key} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-mono text-sm font-medium text-foreground">{key}</p>
                  <p className="text-xs text-foreground-muted">Backend-managed — no rollout metadata exposed</p>
                </div>
                <StatusBadge
                  label={value ? 'Enabled' : 'Disabled'}
                  tone={value ? 'success' : 'neutral'}
                  title={value ? 'Flag is on for this role' : 'Flag is off for this role'}
                />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
