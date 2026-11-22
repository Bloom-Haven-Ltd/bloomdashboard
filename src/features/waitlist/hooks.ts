'use client';

/**
 * Waitlist hooks.
 *
 * Filters are part of the query key because they are server-side: changing one
 * fetches a different slice rather than re-slicing what is already on screen.
 * Every mutation invalidates on *settle* — success or failure — so the list
 * always renders authoritative state instead of an optimistic guess (§70).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchWaitlistSignups,
  fetchWaitlistSignup,
  updateWaitlistStatus,
  type WaitlistListParams,
  type WaitlistStatusAction,
} from './service';
import { useApiQuery } from '@/hooks/useApiQuery';

export const waitlistKeys = {
  list: (filters: Pick<WaitlistListParams, 'page' | 'pageSize' | 'status' | 'interest'>) =>
    [
      'waitlist',
      'list',
      {
        page: filters.page ?? 1,
        pageSize: filters.pageSize ?? 20,
        status: filters.status ?? 'all',
        interest: filters.interest ?? 'all',
      },
    ] as const,
  detail: (id: string) => ['waitlist', 'detail', id] as const,
};

export function useWaitlistSignups(params: WaitlistListParams) {
  return useApiQuery(waitlistKeys.list(params), (signal) => fetchWaitlistSignups({ ...params, signal }));
}

/**
 * The open signup, fetched on its own rather than lifted out of the table row.
 * A drawer showing a row snapshot goes stale the moment a status lands — and
 * the invite note is written against whatever is on screen, so staleness is
 * not cosmetic here.
 */
export function useWaitlistSignup(id: string | null) {
  return useApiQuery(waitlistKeys.detail(id ?? ''), (signal) => fetchWaitlistSignup(id as string, signal), {
    enabled: Boolean(id),
  });
}

/**
 * Move a signup through the launch list. The backend records who made the
 * transition in its logs (id + status only, never the person's details), so
 * the audit trail exists without this client having to send one.
 */
export function useWaitlistStatusUpdate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (action: WaitlistStatusAction) => updateWaitlistStatus(action),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['waitlist'] });
    },
  });
}
