'use client';

/**
 * Route-level error boundary (§43). Renders a professional recovery
 * experience with a retry action. Never displays stack traces.
 */

import { useEffect } from 'react';
import { ErrorState } from '@/components/ui/EmptyState';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // In production this should feed the telemetry pipeline (Phase 10) —
    // server correlation IDs arrive via ApiError.requestId in data errors.
    console.error('[dashboard-error]', error.digest ?? error.message);
  }, [error]);

  return (
    <div className="rounded-lg border border-border bg-surface">
      <ErrorState
        code="UNEXPECTED_ERROR"
        message="The page failed to render. This has been recorded — you can retry safely."
        requestId={error.digest}
        onRetry={reset}
      />
    </div>
  );
}
