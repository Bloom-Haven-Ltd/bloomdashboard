'use client';

/**
 * Finance hooks (§61/§65/§67): interval refetching stands in for the admin
 * realtime channel (none exists — FS-14). Operational queues poll; stats and
 * detail views settle on authoritative state. Withdrawal mutations never
 * optimistically update financial state — they invalidate and refetch (§19).
 */

import { fetchFinanceTransactions, fetchPaymentDetail, fetchPaymentReceipt, fetchPaymentStats, fetchPayments, fetchPendingWithdrawals, runWalletReconciliation } from './service';
import { useApiQuery, useQueryClient } from '@/hooks/useApiQuery';
import { useMutation } from '@tanstack/react-query';
import type { UseQueryOptions } from '@tanstack/react-query';
import type { ApiError } from '@/lib/api/error';
import type { PaymentListResult } from './service';

export const financeKeys = {
  payments: (page: number, pageSize: number, status: string, serviceType: string) =>
    ['finance', 'payments', { page, pageSize, status, serviceType }] as const,
  detail: (id: string) => ['finance', 'payments', 'detail', id] as const,
  receipt: (id: string) => ['finance', 'payments', 'receipt', id] as const,
  stats: ['finance', 'stats'] as const,
  transactions: (page: number, pageSize: number) => ['finance', 'transactions', { page, pageSize }] as const,
  withdrawals: ['finance', 'withdrawals', 'pending'] as const,
};

export function usePayments(
  page: number,
  pageSize = 20,
  status = 'all',
  serviceType = 'all',
  options?: Pick<UseQueryOptions<PaymentListResult, ApiError, PaymentListResult>, 'refetchInterval'>
) {
  return useApiQuery(financeKeys.payments(page, pageSize, status, serviceType), (signal) =>
    fetchPayments({ page, pageSize, signal, status, serviceType }),
    options
  );
}

/** 404 settles to null for clean deep-link not-found states. */
export function usePaymentDetail(id: string) {
  return useApiQuery(financeKeys.detail(id), (signal) => fetchPaymentDetail(id, signal), {
    enabled: Boolean(id),
  });
}

export function usePaymentReceipt(id: string) {
  return useApiQuery(financeKeys.receipt(id), (signal) => fetchPaymentReceipt(id, signal), {
    enabled: Boolean(id),
  });
}

export function usePaymentStats(options?: { refetchInterval?: number | false }) {
  return useApiQuery(financeKeys.stats, (signal) => fetchPaymentStats(signal), options);
}

export function useFinanceTransactions(page: number, pageSize = 50) {
  return useApiQuery(financeKeys.transactions(page, pageSize), (signal) =>
    fetchFinanceTransactions(page, pageSize, signal)
  );
}

/** Pending withdrawal queue — polls while visible (§24). */
export function usePendingWithdrawals(options?: { refetchInterval?: number | false }) {
  return useApiQuery(financeKeys.withdrawals, (signal) => fetchPendingWithdrawals(signal), options);
}

export function useWalletReconciliation() {
  const queryClient = useQueryClient();
  const mutation = useMutation({ mutationFn: () => runWalletReconciliation(undefined) });

  return {
    ...mutation,
    /** Fire a run and refetch authoritative financial state afterwards. */
    run: async () => {
      const result = await mutation.mutateAsync();
      void queryClient.invalidateQueries({ queryKey: ['finance'] });
      return result;
    },
  };
}
