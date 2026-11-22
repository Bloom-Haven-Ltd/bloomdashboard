'use client';

/**
 * Public-inquiries hooks.
 *
 * Filters are part of the query key because they are server-side: changing one
 * fetches a different slice rather than re-slicing what is already on screen.
 * Every mutation invalidates on *settle* — success or failure — so the inbox
 * always renders authoritative state instead of an optimistic guess (§70).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchInquiries,
  fetchInquiry,
  updateInquiryStatus,
  type InquiryListParams,
  type InquiryStatusAction,
} from './service';
import { useApiQuery } from '@/hooks/useApiQuery';

export const inquiryKeys = {
  list: (filters: Pick<InquiryListParams, 'page' | 'pageSize' | 'status' | 'inquiryType' | 'channel'>) =>
    [
      'inquiries',
      'list',
      {
        page: filters.page ?? 1,
        pageSize: filters.pageSize ?? 20,
        status: filters.status ?? 'all',
        inquiryType: filters.inquiryType ?? 'all',
        channel: filters.channel ?? 'all',
      },
    ] as const,
  detail: (id: string) => ['inquiries', 'detail', id] as const,
};

export function useInquiries(params: InquiryListParams) {
  return useApiQuery(inquiryKeys.list(params), (signal) => fetchInquiries({ ...params, signal }));
}

/**
 * The open record, fetched on its own rather than lifted out of the table row.
 * A drawer that shows a row snapshot goes stale the moment a status lands — and
 * the reply is written against whatever is on screen, so staleness is not
 * cosmetic here.
 */
export function useInquiry(id: string | null) {
  return useApiQuery(inquiryKeys.detail(id ?? ''), (signal) => fetchInquiry(id as string, signal), {
    enabled: Boolean(id),
  });
}

/**
 * Move an inquiry through the inbox. The backend stamps `first_responded_at` the
 * first time a record leaves `new`, so the response-time metric on this table is
 * derived server-side and cannot be edited into place.
 */
export function useInquiryStatusUpdate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (action: InquiryStatusAction) => updateInquiryStatus(action),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['inquiries'] });
    },
  });
}
