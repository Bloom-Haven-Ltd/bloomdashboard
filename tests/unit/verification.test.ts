import { describe, expect, it, vi, afterEach } from 'vitest';
import { fetchPendingVerifications, submitVerificationDecision } from '@/features/verification/service';

vi.mock('@/lib/api/client', () => ({
  apiGet: vi.fn(),
  apiPatch: vi.fn(),
}));

import { apiGet, apiPatch } from '@/lib/api/client';
const mockedApiGet = vi.mocked(apiGet);
const mockedApiPatch = vi.mocked(apiPatch);

afterEach(() => vi.clearAllMocks());

const DOCTOR_ENTRY = {
  id: '11111111-1111-4111-8111-111111111111',
  user_id: '22222222-2222-4222-8222-222222222222',
  name: 'Dr. Kwesi Arthur',
  email: 'kwesi@example.com',
  role: 'doctor',
  created_at: '2026-09-20T10:00:00Z',
  license_number: 'MDC-GH-004213',
};

const LAB_ENTRY = {
  id: '33333333-3333-4333-8333-333333333333',
  user_id: '22222222-2222-4222-8222-222222222222',
  name: '',
  email: 'lab@example.com',
  role: 'lab',
  created_at: '2026-09-21T08:30:00Z',
  documents: { license: { reference: 'LAB-77', fields: 3 } },
};

describe('verification queue service', () => {
  it('parses the bare-array queue and derives display_name', async () => {
    mockedApiGet.mockResolvedValueOnce([DOCTOR_ENTRY, LAB_ENTRY]);
    const items = await fetchPendingVerifications();
    expect(mockedApiGet).toHaveBeenCalledWith('/admin/verifications/pending', expect.anything());
    expect(items).toHaveLength(2);
    expect(items[0].display_name).toBe('Dr. Kwesi Arthur');
    // Empty self-reported names fall back to the email (never render blank rows).
    expect(items[1].display_name).toBe('lab@example.com');
  });

  it('rejects malformed queue payloads instead of rendering them', async () => {
    mockedApiGet.mockResolvedValueOnce([{ ...DOCTOR_ENTRY, role: undefined }]);
    await expect(fetchPendingVerifications()).rejects.toThrowError();
  });
});

describe('verification decision service', () => {
  it('sends approvals without a rejection_reason key', async () => {
    mockedApiPatch.mockResolvedValueOnce({ message: 'ok' });
    await submitVerificationDecision({ role: 'doctor', profileId: DOCTOR_ENTRY.id, approve: true });
    expect(mockedApiPatch).toHaveBeenCalledWith(
      '/admin/verify/doctor/11111111-1111-4111-8111-111111111111',
      { is_verified: true },
      expect.anything()
    );
  });

  it('requires a rejection reason for rejections before calling the API', async () => {
    await expect(
      submitVerificationDecision({ role: 'lab', profileId: LAB_ENTRY.id, approve: false, rejectionReason: '   ' })
    ).rejects.toThrowError(/reason/i);
    expect(mockedApiPatch).not.toHaveBeenCalled();
  });

  it('trims the reason and targets the correct role/profile endpoint', async () => {
    mockedApiPatch.mockResolvedValueOnce({ message: 'ok' });
    await submitVerificationDecision({
      role: 'pharmacy',
      profileId: '33333333-3333-4333-8333-333333333333',
      approve: false,
      rejectionReason: '  License expired  ',
    });
    expect(mockedApiPatch).toHaveBeenCalledWith(
      '/admin/verify/pharmacy/33333333-3333-4333-8333-333333333333',
      { is_verified: false, rejection_reason: 'License expired' },
      expect.anything()
    );
  });
});
