'use client';

/**
 * Partner hooks (§52): stable cache keys, server-side pagination, and
 * detail queries per partner type.
 */

import { fetchDoctors, fetchLabs, fetchPharmacies, fetchPartnerProfile, type PartnerType } from './service';
import { useApiQuery } from '@/hooks/useApiQuery';

export const partnersKeys = {
  list: (type: PartnerType, page: number, pageSize: number, search: string) =>
    ['partners', 'list', type, { page, pageSize, search }] as const,
  detail: (type: PartnerType, id: string) => ['partners', 'detail', type, id] as const,
};

export function useDoctors(page: number, pageSize = 20, search = '') {
  return useApiQuery(partnersKeys.list('doctor', page, pageSize, search), (signal) =>
    fetchDoctors(page, pageSize, search, signal)
  );
}

export function useLabs(page: number, pageSize = 20, search = '') {
  return useApiQuery(partnersKeys.list('lab', page, pageSize, search), (signal) =>
    fetchLabs(page, pageSize, search, signal)
  );
}

export function usePharmacies(page: number, pageSize = 20, search = '') {
  return useApiQuery(partnersKeys.list('pharmacy', page, pageSize, search), (signal) =>
    fetchPharmacies(page, pageSize, search, signal)
  );
}

export function usePartnerDetail(type: PartnerType, id: string, options?: { enabled?: boolean }) {
  return useApiQuery(partnersKeys.detail(type, id), (signal) => fetchPartnerProfile(type, id, signal), {
    enabled: Boolean(id) && (options?.enabled ?? true),
  });
}
