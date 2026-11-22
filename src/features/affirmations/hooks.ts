'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiQuery } from '@/hooks/useApiQuery';
import {
  fetchAffirmations,
  fetchTodayAffirmation,
  createAffirmation,
  updateAffirmation,
  deleteAffirmation,
  pinAffirmationToToday,
  type AffirmationFilters,
  type CreateAffirmationPayload,
  type UpdateAffirmationPayload,
} from './service';

export const affirmationKeys = {
  all: ['affirmations'] as const,
  list: (filters: AffirmationFilters) =>
    [
      'affirmations',
      'list',
      {
        page: filters.page ?? 1,
        pageSize: filters.pageSize ?? 20,
        category: filters.category ?? 'all',
        isActive: filters.isActive,
        scheduledDate: filters.scheduledDate ?? '',
        search: filters.search ?? '',
      },
    ] as const,
  today: ['affirmations', 'today'] as const,
};

export function useAffirmations(filters: AffirmationFilters = {}) {
  return useApiQuery(
    affirmationKeys.list(filters),
    (signal) => fetchAffirmations(filters, signal)
  );
}

export function useTodayAffirmation() {
  return useApiQuery(
    affirmationKeys.today,
    (signal) => fetchTodayAffirmation(signal)
  );
}

export function useCreateAffirmation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateAffirmationPayload) => createAffirmation(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: affirmationKeys.all });
    },
  });
}

export function useUpdateAffirmation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateAffirmationPayload }) =>
      updateAffirmation(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: affirmationKeys.all });
    },
  });
}

export function useDeleteAffirmation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAffirmation(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: affirmationKeys.all });
    },
  });
}

export function usePinAffirmationToday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => pinAffirmationToToday(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: affirmationKeys.all });
    },
  });
}
