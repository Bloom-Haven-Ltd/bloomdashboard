'use client';

/**
 * Thin, ApiError-aware wrappers over TanStack Query so every feature hook
 * surfaces `ApiError` uniformly (code/requestId available to UI states).
 */

import { useQuery, type QueryKey, type UseQueryOptions } from '@tanstack/react-query';
import { ApiError } from '@/lib/api/error';

export function useApiQuery<T>(
  key: QueryKey,
  fetcher: (signal: AbortSignal) => Promise<T>,
  options?: Omit<UseQueryOptions<T, ApiError, T, QueryKey>, 'queryKey' | 'queryFn'>
) {
  return useQuery<T, ApiError, T, QueryKey>({
    queryKey: key,
    queryFn: ({ signal }) => fetcher(signal),
    ...options,
  });
}

export { useQueryClient } from '@tanstack/react-query';
