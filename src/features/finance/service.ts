/**
 * Finance feature service (§11–§32) — oversight layer over backend-authoritative
 * financial state (contracts verified in docs/admin/finance-support-audit.md).
 *
 * READ + two controlled admin workflows:
 *  - Withdrawal approve/reject (backend-gated, reason-captured, audited;
 *    state transitions enforced server-side — §25).
 *  - Wallet↔ledger reconciliation run (backend computes everything — §30).
 *
 * Deliberately NOT wired: refunds (no admin read endpoint FS-1; the admin
 * refund route is broken — FS-9) and the ungated legacy refund route (FS-8).
 * The dashboard never computes balances, refunds or earnings client-side (§22).
 */

import { apiGet, apiPost } from '@/lib/api/client';
import { z } from 'zod';
import { ApiError } from '@/lib/api/error';
import {
  parseWith,
  paginatedPaymentsSchema,
  paymentDetailSchema,
  paymentReceiptSchema,
  paymentStatsSchema,
  paginatedFinanceTransactionsSchema,
  withdrawalListSchema,
  walletReconciliationSchema,
  type PaymentListItemDto,
  type PaymentDetailDto,
  type PaymentReceiptDto,
  type PaymentStatsDto,
  type FinanceTransactionDto,
  type WithdrawalDto,
  type WalletReconciliationDto,
} from '@/lib/api/schemas';

export interface PaymentListParams {
  page?: number;
  pageSize?: number;
  status?: string;
  serviceType?: string;
  signal?: AbortSignal;
}

export interface PaymentListResult {
  items: PaymentListItemDto[];
  total: number;
  totalPages: number;
  page: number;
}

/**
 * GET /payments — paginated; admins receive all rows (service-level role
 * check). Filters limited to status + service_type (backend contract).
 */
export async function fetchPayments(params: PaymentListParams = {}): Promise<PaymentListResult> {
  const { page = 1, pageSize = 20, status, serviceType, signal } = params;
  const query = new URLSearchParams({ page: String(page), page_size: String(Math.min(pageSize, 100)) });
  if (status && status !== 'all') query.set('status', status);
  if (serviceType && serviceType !== 'all') query.set('service_type', serviceType);

  const data = await apiGet<unknown>(`/payments?${query.toString()}`, { signal });
  const parsed = parseWith(paginatedPaymentsSchema, data);
  return { items: parsed.data, total: parsed.total, totalPages: parsed.total_pages, page: parsed.page };
}

/**
 * GET /payments/{id} — owner or admin (get_payment_by_id role check).
 * 404 resolves to null for clean deep-link not-found states.
 */
export async function fetchPaymentDetail(id: string, signal?: AbortSignal): Promise<PaymentDetailDto | null> {
  try {
    const data = await apiGet<unknown>(`/payments/${id}`, { signal });
    const body = data as { data?: unknown };
    return parseWith(paymentDetailSchema, body?.data ?? data);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'NOT_FOUND') return null;
    throw error;
  }
}

/**
 * GET /payments/{id}/receipt — server-built receipt (owner or admin);
 * authoritative names/amounts, never recomputed client-side (§17).
 */
export async function fetchPaymentReceipt(id: string, signal?: AbortSignal): Promise<PaymentReceiptDto | null> {
  try {
    const data = await apiGet<unknown>(`/payments/${id}/receipt`, { signal });
    const body = data as { data?: unknown };
    return parseWith(paymentReceiptSchema, body?.data ?? data);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'NOT_FOUND') return null;
    throw error;
  }
}

/** GET /payments/admin/stats — all-time totals (no date-range support, FS-11). */
export async function fetchPaymentStats(signal?: AbortSignal): Promise<PaymentStatsDto> {
  const data = await apiGet<unknown>('/payments/admin/stats', { signal });
  const body = data as { data?: unknown };
  return parseWith(paymentStatsSchema, body?.data ?? data);
}

export interface FinanceTransactionListResult {
  items: FinanceTransactionDto[];
  total: number;
  totalPages: number;
  page: number;
}

/** GET /admin/finance/transactions — global wallet-transaction feed. */
export async function fetchFinanceTransactions(
  page = 1,
  pageSize = 50,
  signal?: AbortSignal
): Promise<FinanceTransactionListResult> {
  const query = new URLSearchParams({ page: String(page), page_size: String(Math.min(pageSize, 200)) });
  const data = await apiGet<unknown>(`/admin/finance/transactions?${query.toString()}`, { signal });
  const parsed = parseWith(paginatedFinanceTransactionsSchema, data);
  return { items: parsed.data, total: parsed.total, totalPages: parsed.total_pages, page: parsed.page };
}

/** GET /withdrawals/pending — bare list; account numbers masked at parse. */
export async function fetchPendingWithdrawals(signal?: AbortSignal): Promise<WithdrawalDto[]> {
  const data = await apiGet<unknown>('/withdrawals/pending?limit=100', { signal });
  return parseWith(withdrawalListSchema, data);
}

export interface WithdrawalActionResult {
  withdrawal: WithdrawalDto | null;
  /** Full unmasked response is intentionally discarded — only masked fields parsed. */
}

/**
 * POST /withdrawals/{id}/approve — backend creates the Paystack transfer
 * recipient, initiates the transfer and reserves funds (pending → approved).
 */
export async function approveWithdrawal(withdrawalId: string, adminId: string): Promise<WithdrawalActionResult> {
  const data = await apiPost<unknown>(`/withdrawals/${withdrawalId}/approve`, { processedBy: adminId });
  return { withdrawal: safeParseWithdrawal(data) };
}

/**
 * POST /withdrawals/{id}/reject — reason required server-side; releases
 * reserved balance (pending|approved → rejected).
 */
export async function rejectWithdrawal(
  withdrawalId: string,
  adminId: string,
  rejectionReason: string
): Promise<WithdrawalActionResult> {
  const data = await apiPost<unknown>(`/withdrawals/${withdrawalId}/reject`, {
    processedBy: adminId,
    rejectionReason,
  });
  return { withdrawal: safeParseWithdrawal(data) };
}

const singleWithdrawalSchema = z.object({}).passthrough();
function safeParseWithdrawal(data: unknown): WithdrawalDto | null {
  try {
    const parsed = parseWith(withdrawalListSchema, [data]);
    return parsed[0] ?? null;
  } catch {
    singleWithdrawalSchema.parse(data); // presence check only
    return null;
  }
}

/**
 * POST /wallets/reconcile — wallet↔ledger reconciliation run (MANUAL_ADMIN).
 * The backend computes every balance; the dashboard only displays (§27/§30).
 */
export async function runWalletReconciliation(signal?: AbortSignal): Promise<WalletReconciliationDto> {
  const data = await apiPost<unknown>('/wallets/reconcile', undefined, { signal });
  return parseWith(walletReconciliationSchema, data);
}
