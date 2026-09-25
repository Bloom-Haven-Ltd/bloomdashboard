'use client';

/**
 * Platform hooks — operational signals poll (backend has no admin realtime,
 * PS-6); configuration reads stay static. Health polls aggressively because
 * it is the "is the platform alive" signal (§68: always show last-updated).
 */

import { fetchAppConfig, fetchAuditLogs, fetchFeatureFlags, fetchPlatformHealth } from './service';
import { useApiQuery } from '@/hooks/useApiQuery';

export const platformKeys = {
  health: ['platform', 'health'] as const,
  appConfig: ['platform', 'app-config'] as const,
  featureFlags: ['platform', 'feature-flags'] as const,
  audit: (page: number, pageSize: number) => ['platform', 'audit', { page, pageSize }] as const,
};

export function usePlatformHealth(options?: { refetchInterval?: number | false }) {
  return useApiQuery(platformKeys.health, (signal) => fetchPlatformHealth(signal), {
    refetchInterval: options?.refetchInterval ?? 30_000,
  });
}

export function useAppConfig() {
  return useApiQuery(platformKeys.appConfig, (signal) => fetchAppConfig(signal), {
    staleTime: 60_000,
  });
}

export function useFeatureFlags() {
  return useApiQuery(platformKeys.featureFlags, (signal) => fetchFeatureFlags(signal), {
    staleTime: 60_000,
  });
}

export function useAuditFeed(page: number, pageSize = 50) {
  return useApiQuery(platformKeys.audit(page, pageSize), (signal) => fetchAuditLogs(page, pageSize, signal));
}
