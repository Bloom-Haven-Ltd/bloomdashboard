import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  paymentDetailSchema,
  paymentStatsSchema,
  paymentsReconciliationSchema,
  withdrawalSchema,
  financeTransactionSchema,
  walletReconciliationSchema,
} from '@/lib/api/schemas';
import {
  fetchPaymentDetail,
  fetchPayments,
  fetchPaymentStats,
  fetchPendingWithdrawals,
  runWalletReconciliation,
} from '@/features/finance/service';
import { runPaymentsReconciliation } from '@/features/finance/paymentsReconciliation';
import { ApiError } from '@/lib/api/error';

vi.mock('@/lib/api/client', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

import { apiGet, apiPost } from '@/lib/api/client';
const mockedGet = vi.mocked(apiGet);
const mockedPost = vi.mocked(apiPost);

afterEach(() => {
  vi.clearAllMocks();
});

describe('finance schemas', () => {
  it('parses payment list items (UPPERCASE statuses, pesewa amounts)', () => {
    const item = {
      id: '11111111-1111-4111-8111-111111111111',
      reference: 'BH-PAY-TEST1',
      amount_ghs: 150,
      amount_pesewas: 15000,
      currency: 'GHS',
      status: 'SUCCESS',
      channel: 'mobile_money',
      service_type: 'CONSULTATION',
      service_id: '22222222-2222-4222-8222-222222222222',
      customer_email: 'p@example.com',
      customer_phone: null,
      paid_at: '2026-09-25T10:00:00Z',
      created_at: '2026-09-25T09:55:00Z',
    };
    const parsed = paymentDetailSchema.parse(item);
    expect(parsed.status).toBe('SUCCESS');
    expect(parsed.amount_ghs).toBe(150);
  });

  it('parses payment stats (backend-authoritative totals)', () => {
    const stats = paymentStatsSchema.parse({
      total_revenue_ghs: 1250,
      total_refunds_ghs: 50,
      net_revenue_ghs: 1200,
      successful_payments_count: 40,
      pending_payments_count: 3,
      failed_payments_count: 2,
      refunded_payments_count: 1,
    });
    expect(stats.net_revenue_ghs).toBe(1200);
  });

  it('masks withdrawal bank account numbers at the parse boundary (FS-10)', () => {
    const wire = {
      id: '33333333-3333-4333-8333-333333333333',
      walletId: '44444444-4444-4444-8444-444444444444',
      providerId: '55555555-5555-4555-8555-555555555555',
      amount: 750,
      bankAccountName: 'Authorized Partner',
      bankAccountNumber: '1234567894821',
      bankName: 'Example Bank',
      status: 'pending',
      requestedAt: '2026-09-25T08:00:00Z',
      updatedAt: '2026-09-25T08:00:00Z',
    };
    const parsed = withdrawalSchema.parse(wire);
    expect(parsed.bank_account_masked).toBe('•••• 4821');
    expect(JSON.stringify(parsed)).not.toContain('1234567894821');
    expect(parsed.bank_account_name).toBe('Authorized Partner');
    expect(parsed.status).toBe('pending');
  });

  it('normalizes camelCase wallet transactions (timestamp → created_at)', () => {
    const parsed = financeTransactionSchema.parse({
      id: '66666666-6666-4666-8666-666666666666',
      walletId: '44444444-4444-4444-8444-444444444444',
      providerId: '55555555-5555-4555-8555-555555555555',
      type: 'credit',
      amount: 97.5,
      balanceAfter: 1200,
      referenceId: 'BH-PAY-TEST1',
      status: 'completed',
      timestamp: '2026-09-25T09:00:00Z',
      metadata: {},
    });
    expect(parsed.created_at).toBe('2026-09-25T09:00:00Z');
    expect(parsed.reference_id).toBe('BH-PAY-TEST1');
  });

  it('parses wallet reconciliation discrepancies', () => {
    const parsed = walletReconciliationSchema.parse({
      reconciliation_id: '77777777-7777-4777-8777-777777777777',
      status: 'DISCREPANCIES_DETECTED',
      total_checked: 5,
      matched_count: 4,
      mismatched_count: 1,
      discrepancies: [
        {
          provider_id: '55555555-5555-4555-8555-555555555555',
          wallet_id: '44444444-4444-4444-8444-444444444444',
          wallet_total_funds: 100,
          ledger_balance: 90,
          difference: 10,
          currency: 'GHS',
        },
      ],
      timestamp: '2026-09-25T09:30:00Z',
    });
    expect(parsed.mismatched_count).toBe(1);
    expect(parsed.discrepancies?.[0].difference).toBe(10);
  });

  it('parses payments-Paystack reconciliation items', () => {
    const parsed = paymentsReconciliationSchema.parse({
      generated_at: '2026-09-25T09:40:00Z',
      total_checked: 50,
      matched_count: 49,
      mismatch_count: 1,
      items: [
        {
          reference: 'BH-PAY-M1',
          bloom_status: 'SUCCESS',
          gateway_status: null,
          bloom_amount_pesewas: 15000,
          gateway_amount_pesewas: null,
          result: 'MISSING_GATEWAY_RECORD',
          details: 'Gateway has no transaction for this reference',
        },
      ],
    });
    expect(parsed.items?.[0].result).toBe('MISSING_GATEWAY_RECORD');
    expect(parsed.items?.[0].gateway_amount_pesewas).toBeNull();
  });
});

describe('finance services', () => {
  it('fetchPayments forwards status/service filters with page cap', async () => {
    mockedGet.mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          reference: 'BH-PAY-TEST1',
          amount_ghs: 150,
          currency: 'GHS',
          status: 'SUCCESS',
          service_type: 'CONSULTATION',
          service_id: '22222222-2222-4222-8222-222222222222',
          created_at: '2026-09-25T09:55:00Z',
        },
      ],
      total: 1,
      page: 1,
      page_size: 20,
      total_pages: 1,
    });
    const result = await fetchPayments({ page: 2, pageSize: 500, status: 'SUCCESS', serviceType: 'CONSULTATION' });
    const call = mockedGet.mock.calls[0][0];
    expect(call).toContain('/payments?');
    expect(call).toContain('page=2');
    expect(call).toContain('page_size=100');
    expect(call).toContain('status=SUCCESS');
    expect(call).toContain('service_type=CONSULTATION');
    expect(result.items).toHaveLength(1);
  });

  it('fetchPaymentDetail unwraps the ApiResponse data field', async () => {
    mockedGet.mockResolvedValueOnce({
      success: true,
      data: {
        id: '11111111-1111-4111-8111-111111111111',
        reference: 'BH-PAY-TEST1',
        amount_ghs: 150,
        currency: 'GHS',
        status: 'PENDING',
        service_type: 'CONSULTATION',
        service_id: '22222222-2222-4222-8222-222222222222',
        created_at: '2026-09-25T09:55:00Z',
      },
    });
    const detail = await fetchPaymentDetail('11111111-1111-4111-8111-111111111111');
    expect(detail?.status).toBe('PENDING');
  });

  it('fetchPaymentDetail maps 404 to null for deep links', async () => {
    mockedGet.mockRejectedValueOnce(new ApiError('NOT_FOUND', 'Not found', { status: 404 }));
    const detail = await fetchPaymentDetail('88888888-8888-4888-8888-888888888888');
    expect(detail).toBeNull();
  });

  it('fetchPaymentStats unwraps the ApiResponse wrapper', async () => {
    mockedGet.mockResolvedValueOnce({
      success: true,
      data: {
        total_revenue_ghs: 1250,
        total_refunds_ghs: 50,
        net_revenue_ghs: 1200,
        successful_payments_count: 40,
        pending_payments_count: 3,
        failed_payments_count: 2,
        refunded_payments_count: 1,
      },
    });
    const stats = await fetchPaymentStats();
    expect(stats.net_revenue_ghs).toBe(1200);
  });

  it('fetchPendingWithdrawals parses a bare list and masks accounts', async () => {
    mockedGet.mockResolvedValueOnce([
      {
        id: '33333333-3333-4333-8333-333333333333',
        providerId: '55555555-5555-4555-8555-555555555555',
        amount: 750,
        bankAccountName: 'Authorized Partner',
        bankAccountNumber: '9876543210011',
        bankName: 'Example Bank',
        status: 'pending',
        requestedAt: '2026-09-25T08:00:00Z',
      },
    ]);
    const items = await fetchPendingWithdrawals();
    expect(items).toHaveLength(1);
    expect(items[0].bank_account_masked).toBe('•••• 0011');
    expect(JSON.stringify(items[0])).not.toContain('9876543210011');
  });

  it('approveWithdrawal posts processedBy', async () => {
    mockedPost.mockResolvedValueOnce({
      id: '33333333-3333-4333-8333-333333333333',
      status: 'approved',
      bankAccountNumber: '1234567894821',
      requestedAt: '2026-09-25T08:00:00Z',
      updatedAt: '2026-09-25T09:00:00Z',
    });
    await import('@/features/finance/service').then((m) => m.approveWithdrawal('33333333-3333-4333-8333-333333333333', 'admin-1'));
    expect(mockedPost).toHaveBeenCalledWith('/withdrawals/33333333-3333-4333-8333-333333333333/approve', {
      processedBy: 'admin-1',
    });
  });

  it('runWalletReconciliation returns backend-computed results', async () => {
    mockedPost.mockResolvedValueOnce({
      reconciliation_id: '77777777-7777-4777-8777-777777777777',
      status: 'CLEAN',
      total_checked: 5,
      matched_count: 5,
      mismatched_count: 0,
      discrepancies: [],
      timestamp: '2026-09-25T09:30:00Z',
    });
    const result = await runWalletReconciliation();
    expect(result.status).toBe('CLEAN');
    expect(mockedPost).toHaveBeenCalledWith('/wallets/reconcile', undefined, expect.anything());
  });

  it('runPaymentsReconciliation divides pesewas for display', async () => {
    mockedPost.mockResolvedValueOnce({
      generated_at: '2026-09-25T09:40:00Z',
      total_checked: 50,
      matched_count: 49,
      mismatch_count: 1,
      items: [
        {
          reference: 'BH-PAY-M1',
          bloom_status: 'SUCCESS',
          bloom_amount_pesewas: 15000,
          gateway_amount_pesewas: null,
          result: 'MATCH',
        },
      ],
    });
    const result = await runPaymentsReconciliation();
    expect(result.items[0].bloomAmountGhs).toBe(150);
    expect(result.items[0].gatewayAmountGhs).toBeNull();
  });
});
