/**
 * Payments↔Paystack reconciliation (§28) — contract for the backend engine
 * (POST /payments/admin/reconcile, admin-gated). Every match/mismatch is
 * computed server-side; the dashboard displays the inline report verbatim.
 * Amounts are pesewas — divided by 100 for display only, never recomputed.
 */

import { apiPost } from '@/lib/api/client';
import { parseWith, paymentsReconciliationSchema } from '@/lib/api/schemas';

export interface PaymentReconItem {
  reference: string;
  result: string;
  bloomStatus: string | null;
  gatewayStatus: string | null;
  bloomAmountGhs: number | null;
  gatewayAmountGhs: number | null;
  details: string | null;
}

export interface PaymentsReconciliationResult {
  generatedAt: string;
  totalChecked: number;
  matchedCount: number;
  mismatchCount: number;
  items: PaymentReconItem[];
}

export async function runPaymentsReconciliation(limit = 100): Promise<PaymentsReconciliationResult> {
  const data = await apiPost<unknown>(`/payments/admin/reconcile?limit=${limit}`);
  const parsed = parseWith(paymentsReconciliationSchema, data);
  return {
    generatedAt: parsed.generated_at,
    totalChecked: parsed.total_checked,
    matchedCount: parsed.matched_count,
    mismatchCount: parsed.mismatch_count,
    items: (parsed.items ?? []).map((item) => ({
      reference: item.reference,
      result: item.result,
      bloomStatus: item.bloom_status ?? null,
      gatewayStatus: item.gateway_status ?? null,
      bloomAmountGhs: item.bloom_amount_pesewas != null ? item.bloom_amount_pesewas / 100 : null,
      gatewayAmountGhs: item.gateway_amount_pesewas != null ? item.gateway_amount_pesewas / 100 : null,
      details: item.details ?? null,
    })),
  };
}
