'use client';

/**
 * Laboratory feature hooks — server-side pagination over backend feeds
 * (audit PL-13: no realtime admin channel; feeds refresh on demand).
 */

import { fetchLabBookings, fetchLabCatalog, fetchLabProfile } from './service';
import { useApiQuery } from '@/hooks/useApiQuery';

export const laboratoryKeys = {
  bookings: (page: number, pageSize: number) => ['laboratory', 'bookings', { page, pageSize }] as const,
  profile: (id: string) => ['laboratory', 'profile', id] as const,
  catalog: (category: string, search: string) => ['laboratory', 'catalog', { category, search }] as const,
};

export function useLabBookings(page: number, pageSize = 20) {
  return useApiQuery(laboratoryKeys.bookings(page, pageSize), (signal) => fetchLabBookings(page, pageSize, signal));
}

export function useLabProfile(id: string) {
  return useApiQuery(laboratoryKeys.profile(id), (signal) => fetchLabProfile(id, signal), {
    enabled: Boolean(id),
  });
}

export function useLabCatalog(params: { category?: string; search?: string } = {}) {
  const category = params.category?.trim() ?? '';
  const search = params.search?.trim() ?? '';
  return useApiQuery(laboratoryKeys.catalog(category, search), (signal) =>
    fetchLabCatalog({ category, search }, signal)
  );
}
