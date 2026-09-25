'use client';

/**
 * TanStack Query provider.
 *
 * Server-state defaults tuned for an administrative console:
 * - Fresh data is assumed stale after 30s (not aggressively refetched).
 * - Failed GETs retry once with backoff; 4xx never retried.
 * - Mutations are never retried automatically (§11).
 * - Window refetch disabled: administrators refresh deliberately.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ApiError } from '@/lib/api/error';

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: (failureCount, error) => {
          if (error instanceof ApiError) {
            // Never retry auth failures or client errors.
            if (error.isAuthFailure) return false;
            if (error.status !== undefined && error.status < 500) return false;
          }
          return failureCount < 1;
        },
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  // One client per browser session; useState avoids recreating on HMR.
  const [queryClient] = useState(createQueryClient);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
