'use client';

/**
 * Verification hooks (§52/§63): one authoritative queue query, one decision
 * mutation. Cache invalidation after every settle keeps every queue surface
 * (center, review page, partner deep-links) consistent with backend state.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchPendingVerifications, submitVerificationDecision, type VerificationAction } from './service';
import { useApiQuery } from '@/hooks/useApiQuery';
import { dashboardKeys } from '@/features/dashboard/hooks';

export const verificationKeys = {
  pending: ['verification', 'pending'] as const,
};

export function usePendingVerifications() {
  return useApiQuery(verificationKeys.pending, (signal) => fetchPendingVerifications(signal), {
    // Decisions land on other admins' queues too — poll so the queue stays
    // current without websocket events (none exist yet; audit BG-9).
    refetchInterval: 60_000,
  });
}

/**
 * Approve/reject a verification. Audited server-side; queue and platform
 * stats are invalidated after settle — success or failure — so the UI always
 * refetches authoritative state (§70).
 */
export function useVerificationDecision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (action: VerificationAction) => submitVerificationDecision(action),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: verificationKeys.pending });
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.stats });
    },
  });
}
