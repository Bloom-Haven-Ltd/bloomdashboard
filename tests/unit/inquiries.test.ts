import { describe, expect, it, vi, afterEach } from 'vitest';
import { fetchInquiries, updateInquiryStatus } from '@/features/inquiries/service';

vi.mock('@/lib/api/client', () => ({
  apiGet: vi.fn(),
  apiPatch: vi.fn(),
}));

import { apiGet, apiPatch } from '@/lib/api/client';
const mockedApiGet = vi.mocked(apiGet);
const mockedApiPatch = vi.mocked(apiPatch);

afterEach(() => vi.clearAllMocks());

const ENQUIRY = {
  id: '11111111-1111-4111-8111-111111111111',
  inquiry_type: 'partnership',
  channel: 'website_partner',
  name: 'Ama Mensah',
  email: 'ama@clinic.example',
  phone: '233241234567',
  organization: 'Kumasi Care Clinic',
  organization_type: 'clinic',
  partnership_interest: 'provider_onboarding',
  message: 'We would like to list our clinic on Bloom.',
  source_path: '/partners',
  status: 'new',
  internal_note: null,
  first_responded_at: null,
  created_at: '2026-09-28T09:15:00Z',
  updated_at: '2026-09-28T09:15:00Z',
};

function envelope(data: unknown[], overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    data,
    total: data.length,
    page: 1,
    page_size: 20,
    total_pages: 1,
    ...overrides,
  };
}

describe('inquiries list service', () => {
  it('omits "all" filters instead of sending a value the backend rejects', async () => {
    mockedApiGet.mockResolvedValueOnce(envelope([ENQUIRY]));
    const result = await fetchInquiries({
      page: 2,
      pageSize: 20,
      status: 'all',
      inquiryType: 'all',
      channel: 'all',
    });

    const endpoint = mockedApiGet.mock.calls[0][0];
    expect(endpoint).toContain('page=2');
    expect(endpoint).not.toContain('status=');
    expect(endpoint).not.toContain('inquiry_type=');
    expect(endpoint).not.toContain('channel=');
    expect(result.inquiries[0].name).toBe('Ama Mensah');
    expect(result.total).toBe(1);
  });

  it('passes real filter values through as the backend spells them', async () => {
    mockedApiGet.mockResolvedValueOnce(envelope([]));
    await fetchInquiries({ page: 1, status: 'new', inquiryType: 'partnership', channel: 'website_contact' });

    expect(mockedApiGet.mock.calls[0][0]).toContain('/inquiries?');
    expect(mockedApiGet.mock.calls[0][0]).toContain('status=new');
    expect(mockedApiGet.mock.calls[0][0]).toContain('inquiry_type=partnership');
    expect(mockedApiGet.mock.calls[0][0]).toContain('channel=website_contact');
  });

  it('refuses to render a record whose status the inbox cannot name', async () => {
    // A drifted enum must fail the parse rather than show an admin a badge that
    // means nothing — the alternative is acting on a misread state.
    mockedApiGet.mockResolvedValueOnce(envelope([{ ...ENQUIRY, status: 'under_consultation' }]));
    await expect(fetchInquiries({})).rejects.toThrowError();
  });

  it('normalises the backend envelope keys for the table', async () => {
    mockedApiGet.mockResolvedValueOnce(envelope([ENQUIRY], { total: 43, page: 2, page_size: 20, total_pages: 3 }));
    const result = await fetchInquiries({ page: 2 });
    expect(result.totalPages).toBe(3);
    expect(result.page).toBe(2);
  });
});

describe('inquiries status workflow', () => {
  it('blocks an archive with no reason before touching the network', async () => {
    await expect(updateInquiryStatus({ id: ENQUIRY.id, status: 'archived', internalNote: '   ' })).rejects.toThrowError(
      /archiv/i,
    );
    expect(mockedApiPatch).not.toHaveBeenCalled();
  });

  it('sends the trimmed note and the exact backend field names', async () => {
    mockedApiPatch.mockResolvedValueOnce({ ...ENQUIRY, status: 'responded' });
    const updated = await updateInquiryStatus({
      id: ENQUIRY.id,
      status: 'responded',
      internalNote: '  Replied from partnerships@  ',
    });

    expect(mockedApiPatch).toHaveBeenCalledWith(
      `/inquiries/${ENQUIRY.id}/status`,
      { status: 'responded', internal_note: 'Replied from partnerships@' },
    );
    expect(updated.status).toBe('responded');
  });

  it('sends a null note when only the state changes', async () => {
    mockedApiPatch.mockResolvedValueOnce({ ...ENQUIRY, status: 'in_review' });
    await updateInquiryStatus({ id: ENQUIRY.id, status: 'in_review' });
    expect(mockedApiPatch.mock.calls[0][1]).toEqual({ status: 'in_review', internal_note: null });
  });

  it('refuses an over-long note instead of letting the server reject it', async () => {
    await expect(
      updateInquiryStatus({ id: ENQUIRY.id, status: 'closed', internalNote: 'x'.repeat(2001) }),
    ).rejects.toThrowError(/2,000/);
    expect(mockedApiPatch).not.toHaveBeenCalled();
  });
});
