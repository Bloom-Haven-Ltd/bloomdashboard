'use client';

/**
 * Platform health query hook (§11/§12). Health is one of the few surfaces
 * where light auto-refresh is appropriate: 60s, no window-focus refetch
 * storms, cheap endpoint.
 */

import { useApiQuery } from '@/hooks/useApiQuery';
import { fetchPlatformHealth } from './service';

export const healthKeys = {
  platform: ['health', 'platform'] as const,
};

export function usePlatformHealth() {
  return useApiQuery(healthKeys.platform, () => fetchPlatformHealth(), {
    staleTime: 30_000,
    // Health is cheap and operationally important: refresh every 60s (§11).
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
    // Network failures are a health *signal*, not a query error — the service
    // converts them, so retries here only apply to unexpected paths.
    retry: 0,
  });
}
