'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchUsers, fetchUserDetail, updateUserStatus, type UserDetail } from './service';
import { useApiQuery } from '@/hooks/useApiQuery';

export const usersKeys = {
  list: (params: { page: number; pageSize: number; role: string; search: string }) =>
    ['users', 'list', params] as const,
  detail: (id: string) => ['users', 'detail', id] as const,
};

export function useUsers(params: { page: number; pageSize: number; role: string; search: string }) {
  return useApiQuery(usersKeys.list(params), (signal) => fetchUsers({ ...params, signal }), {
    placeholderData: (previous) => previous,
  });
}

export function useUserDetail(id: string) {
  return useApiQuery(usersKeys.detail(id), (signal) => fetchUserDetail(id, signal), {
    enabled: Boolean(id),
  });
}

/**
 * Suspend/reactivate a user. Backend-authoritative and audited server-side.
 * Cache is invalidated so list and detail views reflect the change (§13).
 */
export function useUpdateUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      updateUserStatus(userId, isActive),
    onSettled: (_data, _error, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      if (variables?.userId) {
        void queryClient.invalidateQueries({ queryKey: usersKeys.detail(variables.userId) });
      }
    },
  });
}

export type { UserDetail };
