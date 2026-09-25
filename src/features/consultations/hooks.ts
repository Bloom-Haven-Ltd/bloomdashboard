'use client';

/**
 * Clinical operations hooks (§53/§65): interval refetching stands in for the
 * admin realtime channel (none exists — audit CG-7). Presence polls only
 * while a session is live; the feed polls slowly. Detail queries settle 404s
 * to null for clean deep-link not-found states.
 */

import { fetchConsultationDetail, fetchConsultationRoom, fetchConsultations, fetchSessionEvents } from './service';
import { useApiQuery } from '@/hooks/useApiQuery';
import type { UseQueryOptions } from '@tanstack/react-query';
import type { ApiError } from '@/lib/api/error';
import type { ConsultationListResult } from './service';

export const operationsKeys = {
  consultations: (page: number, pageSize: number, status: string) =>
    ['operations', 'consultations', { page, pageSize, status }] as const,
  detail: (id: string) => ['operations', 'consultations', 'detail', id] as const,
  events: (id: string) => ['operations', 'consultations', 'events', id] as const,
  room: (id: string) => ['operations', 'consultations', 'room', id] as const,
};

export function useConsultations(
  page: number,
  pageSize = 20,
  status = 'all',
  options?: Pick<UseQueryOptions<ConsultationListResult, ApiError, ConsultationListResult>, 'refetchInterval'>
) {
  return useApiQuery(operationsKeys.consultations(page, pageSize, status), (signal) =>
    fetchConsultations({ page, pageSize, signal, status }),
    options
  );
}

export function useConsultationDetail(id: string) {
  return useApiQuery(operationsKeys.detail(id), (signal) => fetchConsultationDetail(id, signal), {
    enabled: Boolean(id),
  });
}

export function useSessionEvents(id: string) {
  return useApiQuery(operationsKeys.events(id), (signal) => fetchSessionEvents(id, signal), {
    enabled: Boolean(id),
  });
}

/**
 * Room presence. Polls every 15 s while the session is ready/in-progress
 * (§34/§36), otherwise fetches once and stays static.
 */
export function useConsultationRoom(id: string, live: boolean) {
  return useApiQuery(operationsKeys.room(id), (signal) => fetchConsultationRoom(id, signal), {
    enabled: Boolean(id),
    refetchInterval: live ? 15_000 : false,
  });
}
